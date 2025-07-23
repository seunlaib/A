import type { AppSyncResolverHandler } from 'aws-lambda';
import { exec as execAsync } from 'node:child_process';
import { mkdir as mkdirAsync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import type { DeploySiteInput } from './graphql';
import logger from './logger';
import download from './download';
import inflate from './inflate';
import { sitesBucket } from './s3';

// Necessary to resolve git binaries and their libraries
process.env.PATH = `/var/task/bin:/opt/awscli:${process.env.PATH}`;
process.env.LD_LIBRARY_PATH = `/var/task/lib:${process.env.LD_LIBRARY_PATH}`;

const exec = promisify(execAsync);
const mkdir = promisify(mkdirAsync);

const handler: AppSyncResolverHandler<DeploySiteInput, boolean> = async (event) => {
  const { id, hash, publicDirectory } = event.arguments;
  const cwd = join('/tmp', 'repos', id);
  const gitDir = join(cwd, '.git');

  let stdout = '';
  let stderr = '';

  // Download repo
  try {
    await mkdir(gitDir, { recursive: true });
    const { Body } = await download(`${id}.git`);

    if (!Body || !(Body instanceof Readable)) throw new Error(`Cannot read repository ${id}.git`);
    await inflate(Body, gitDir);
  } catch (e: any) {
    logger.error(e);
    console.log(e);
    return false;
  }

  // Inflate and extract repo, then checkout requested hash.
  // The last line sets the last modified date to the last commit timestamp that
  // touched that particular file. This ensures idempotence when running aws s3 sync.
  ({ stdout, stderr } = await exec(`\
    git config core.bare false && \
    git config advice.detachedHead false && \
    git checkout ${hash} && \
    for file in $(git ls-files); do touch -d "$(git log -1 --format=%cI -- "$file")" "$file"; done \
  `, { cwd }));
  if (stdout) logger.debug(stdout);
  if (stderr) logger.info(stderr); // don't return false because git logs info messages to stderr

  // Upload site
  // TODO: This may be limited to 1,000 objects
  ({ stdout, stderr } = await exec(`aws s3 sync ${join(cwd, publicDirectory.replaceAll(/\.+\//g, ''), '/')} s3://${sitesBucket}/${id} --delete --exclude ".git*"`));
  if (stdout) logger.debug(stdout);
  if (stderr) logger.error(stderr);

  // Grep list of changed files from sync output
  // TODO: If there is a way to determine whether a file is added or modified, we could reduce the
  // invalidation list to only the modified files (makes no sense to invalidate new paths)
  const changedFiles = stdout
    .split(/[\n\r]/)
    .filter((line) => line.toLowerCase().startsWith('upload') || line.toLowerCase().startsWith('delete'))
    .map((line) => line.replace(/^.+?s3:\/\/.+?\/.+?(\/.+)$/, '"$1"'))
    .join(' '); // e.g.: "/index.html" "/lib/styles.css" "/lib/img/happy_man.jpg"

  logger.debug('Changed files', changedFiles);

  if (changedFiles.length) {
    // Get Distribution
    ({ stdout, stderr } = await exec(`aws resourcegroupstaggingapi get-resources --tag-filters Key=Customer,Values=${id} --resource-type-filters 'cloudfront'`));
    if (stdout) logger.debug(stdout);
    if (stderr) logger.error(stderr);
    const distribution = JSON.parse(stdout).ResourceTagMappingList[0].ResourceARN.replace(/.+\/(.+)$/, '$1');
    logger.debug(`Using distribution ${distribution}`);

    // Add bucket prefix to item paths
    const files = changedFiles.replaceAll('"', '').split(' ').map((s) => `"${id}${s}"`).join(' ');

    // Add Object Tags
    const tags = JSON.stringify({
      TagSet: [
        { Key: 'Product', Value: 'ghosthost' },
        { Key: 'Environment', Value: process.env.NODE_ENV },
        { Key: 'Manager', Value: 'lambda-deploy' },
        { Key: 'Customer', Value: id },
      ],
    });
    ({ stdout, stderr } = await exec(`for key in ${files}; do aws s3api put-object-tagging --bucket ${sitesBucket} --key $key --tagging '${tags}'; done`));
    if (stdout) logger.debug(stdout);
    if (stderr) logger.error(stderr);

    // Invalidate cache for only changed files
    ({ stdout, stderr } = await exec(`aws cloudfront create-invalidation --distribution-id ${distribution} --paths ${changedFiles}`));
    if (stdout) logger.debug(stdout);
    if (stderr) logger.error(stderr);
  } else logger.info('No changes.');

  await exec(`rm -rf ${cwd}`); // clean up

  return true;
};

export default handler;
