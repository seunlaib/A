import { AppSyncResolverEvent } from 'aws-lambda';
// import fs from "node:fs"
import { Readable } from 'node:stream';
import { SdkStream } from '@aws-sdk/types';
import { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import logger from './logger';
import download from './download';
import { DeploySiteInput } from './graphql';
import inflate from './inflate';
import { deflate } from './deflate';

const execMock = jest.fn();
const callback = () => {};

jest.mock('./download');
jest.mock('./logger');
jest.mock('./inflate');
jest.mock('node:child_process', () => ({
  exec: jest.fn(),
}));
jest.mock('node:util', () => {
  const actual = jest.requireActual('node:util');
  return {
    ...actual,
    promisify: jest.fn(() => execMock),
  };
});
import handler from './index';
const event:AppSyncResolverEvent<DeploySiteInput, any> = {
  arguments: {
    id: 'test.ghosthost.site',
    publicDirectory: '.',
    hash: '',
  },
  identity: {
    claims: {
      sub: '192879fc-a240-4bf1-ab5a-d6a00f3063f9',
      email_verified: true,
      iss: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-xxxxxxxxxxx',
      phone_number_verified: false,
      'cognito:username': 'jdoe',
      aud: '7471s60os7h0uu77i1tk27sp9n',
      event_id: 'bc334ed8-a938-4474-b644-9547e304e606',
      token_use: 'id',
      auth_time: 1599154213,
      phone_number: '+19999999999',
      exp: 1599157813,
      iat: 1599154213,
      email: 'jdoe@email.com',
    },
    defaultAuthStrategy: 'ALLOW',
    groups: null,
    issuer: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-xxxxxxxxxxx',
    sourceIp: [
      '1.1.1.1',
    ],
    sub: '192879fc-a240-4bf1-ab5a-d6a00f3063f9',
    username: 'jdoe',
  },
  source: {},
  request: {
    headers: {
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      'cloudfront-viewer-country': 'US',
      'cloudfront-is-tablet-viewer': 'false',
      via: '2.0 xxxxxxxxxxxxxxxx.cloudfront.net (CloudFront)',
      'cloudfront-forwarded-proto': 'https',
      origin: 'https://us-west-1.console.aws.amazon.com',
      'content-length': '217',
      'accept-language': 'en-US,en;q=0.9',
      host: 'xxxxxxxxxxxxxxxx.appsync-api.us-west-1.amazonaws.com',
      'x-forwarded-proto': 'https',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) \
        AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
      accept: '*/*',
      'cloudfront-is-mobile-viewer': 'false',
      'cloudfront-is-smarttv-viewer': 'false',
      'accept-encoding': 'gzip, deflate, br',
      referer: 'https://us-east-1.console.aws.amazon.com/appsync/home?region=us-east-1',
      'content-type': 'application/json',
      'sec-fetch-mode': 'cors',
      'x-amz-cf-id': '3aykhqlUwQeANU-HGY7E_guV5EkNeMMtwyOgiA==',
      'x-amzn-trace-id': 'Root=1-5f512f51-fac632066c5e848ae714',
      authorization: 'eyJraWQiOiJScWFCSlJqYVJlM0hrSnBTUFpIcVRXazNOW...',
      'sec-fetch-dest': 'empty',
      'x-amz-user-agent': 'AWS-Console-AppSync/',
      'cloudfront-is-desktop-viewer': 'true',
      'sec-fetch-site': 'cross-site',
      'x-forwarded-port': '443',
    },
    domainName: null,
  },
  prev: null,
  info: {
    selectionSetList: [
      'goodFruit',
      'user',
    ],
    selectionSetGraphQL: '{\n  goodFruit\n  user\n}',
    parentTypeName: 'Mutation',
    fieldName: 'updateUser',
    variables: {},
  },
  stash: {},
};

const context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: '',
  functionVersion: '',
  invokedFunctionArn: '',
  memoryLimitInMB: '',
  awsRequestId: '',
  logGroupName: '',
  logStreamName: '',
  getRemainingTimeInMillis(): number {
    throw new Error('Function not implemented.');
  },
  done(): void {
    throw new Error('Function not implemented.');
  },
  fail(): void {
    throw new Error('Function not implemented.');
  },
  succeed(): void {
    throw new Error('Function not implemented.');
  },
};

describe('handler', () => {
  beforeEach(() => {
    (inflate as jest.Mock).mockRejectedValue(new Error('Inflate failed'));
    jest.clearAllMocks();
    // (exec as jest.Mock).mockResolvedValue({ stdout: '', stderr: '' });
    (download as jest.Mock).mockResolvedValue({ Body: { readable: true } });
  });

  it('should have called download at least once', async () => {
    // Arrange
    expect.hasAssertions();
    const mockBody = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      },
    }) as unknown as SdkStream<Readable>;
    const mockDownload = download as jest.MockedFunction<typeof download>;
    mockDownload.mockResolvedValue({
      Body: mockBody,
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
        extendedRequestId: 'mock-extended-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
    } as GetObjectCommandOutput);
    // Action
    await handler(event, context, callback);
    // Assert
    expect(mockDownload).toHaveBeenCalled();
    expect(download).toHaveBeenCalledWith('test.ghosthost.site.git');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should log error on inflate unresolved', async () => {
    // Arrange
    expect.hasAssertions();
    const mockBody = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      },
    }) as unknown as SdkStream<Readable>;
    const mockDownload = download as jest.MockedFunction<typeof download>;
    mockDownload.mockResolvedValue({
      Body: mockBody,
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
        extendedRequestId: 'mock-extended-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
    } as GetObjectCommandOutput);
    // Action
    const result = await handler(event, context, callback);
    // Assert
    expect(logger.error).toHaveBeenCalled();
    expect(result).toBe(false);
  });

it('should successfully download and inflate the repo', async () => {
    // Arrange
    expect.hasAssertions();
    const mockBody = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      },
    }) as unknown as SdkStream<Readable>;
    const mockDownload = download as jest.MockedFunction<typeof download>;
    mockDownload.mockResolvedValue({
      Body: mockBody,
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
        extendedRequestId: 'mock-extended-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
    } as GetObjectCommandOutput);
    const mockInflate = inflate as jest.MockedFunction<typeof inflate>;
    mockInflate.mockResolvedValue(undefined);
    (execMock).mockResolvedValue({ stdout: 'mocked output', stderr: '' });

    // Action
    const result = await handler(event, context, callback);

    // Assert
    expect(mockDownload).toHaveBeenCalledWith('test.ghosthost.site.git');
    expect(mockInflate).toHaveBeenCalledWith(mockBody, expect.stringContaining('/tmp/repos/test.ghosthost.site/.git'));
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should log an error and return false when download fails', async () => {
    // Arrange
    expect.hasAssertions();
    const mockDownload = download as jest.MockedFunction<typeof download>;
    const downloadError = new Error('Cannot read repository test.ghosthost.site.git');
    mockDownload.mockRejectedValue(downloadError);

    // Action
    const result = await handler(event, context, callback);

    // Assert
    expect(mockDownload).toHaveBeenCalledWith('test.ghosthost.site.git');
    expect(logger.error).toHaveBeenCalledWith(downloadError);
    expect(result).toBe(false);
  });
});

it('the aws s3 sync command works properly by verifying that file exists in the destination (sites) s3 bucket in the correct path', async () => {
    // Arrange
    expect.hasAssertions();
    const mockBody = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      },
    }) as unknown as SdkStream<Readable>;
    const mockDownload = download as jest.MockedFunction<typeof download>;
    mockDownload.mockResolvedValue({
      Body: mockBody,
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
        extendedRequestId: 'mock-extended-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
    } as GetObjectCommandOutput);
    (inflate as jest.Mock).mockResolvedValue(undefined);
    (execMock).mockResolvedValue({ stdout: 'mocked output', stderr: '' });
    // Action
    await handler(event, context, callback);
    // Assert
    const s3SyncCall = execMock.mock.calls.find(call => call[0].startsWith('aws s3 sync'));
    expect(s3SyncCall).toBeDefined();
    expect(s3SyncCall[0]).toContain(`s3://${process.env.SITES_BUCKET}/${event.arguments.id}`);
  });

  it('the CloudFront invalidation executes An invalidation clears the cache at these edge locations, requiring them to redownload the latest version of the deployed site', async () => {
    // Arrange
    expect.hasAssertions();
    const mockBody = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      },
    }) as unknown as SdkStream<Readable>;
    const mockDownload = download as jest.MockedFunction<typeof download>;
    mockDownload.mockResolvedValue({
      Body: mockBody,
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
        extendedRequestId: 'mock-extended-request-id',
        attempts: 1,
        totalRetryDelay: 0,
      },
    } as GetObjectCommandOutput);
    (inflate as jest.Mock).mockResolvedValue(undefined);
    const distributionId = 'EXAMPLEDEFUNXYZ';
    execMock.mockImplementation(async (command: string) => {
      if (command.startsWith('aws resourcegroupstaggingapi get-resources')) {
        return { stdout: JSON.stringify({ ResourceTagMappingList: [{ ResourceARN: `arn:aws:cloudfront::123456789012:distribution/${distributionId}` }] }), stderr: '' };
      }
      if (command.startsWith('aws s3 sync')) {
        return { stdout: 'upload: index.html to s3://test-bucket/test.ghosthost.site/index.html', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });
    // Action
    await handler(event, context, callback);
    // Assert
    const invalidationCall = execMock.mock.calls.find(call => call[0].startsWith('aws cloudfront create-invalidation'));
    expect(invalidationCall).toBeDefined();
    expect(invalidationCall[0]).toContain(`--distribution-id ${distributionId}`);
    expect(invalidationCall[0]).toContain('--paths "/index.html"');
  });

  it('should checkout the specified commit hash and include its files in sync', async () => {
    // Arrange
    expect.hasAssertions();
    const targetHash = 'abcdef123456';
    const markerFileName = 'file_from_specific_commit.txt';
    event.arguments.hash = targetHash;
    event.arguments.publicDirectory = '.'; // Assuming files are in the root

    const mockBody = new Readable({ read() { this.push(null); } }) as unknown as SdkStream<Readable>;
    (download as jest.Mock).mockResolvedValue({ Body: mockBody } as GetObjectCommandOutput);
    (inflate as jest.Mock).mockResolvedValue(undefined);

    let correctHashCheckedOut = false;
    const s3SyncMarkerFilePath = `/${markerFileName}`; // Path as it would appear in CloudFront invalidation

    execMock.mockImplementation(async (command: string) => {
      if (command.includes(`git checkout ${targetHash}`)) {
        correctHashCheckedOut = true;
        return { stdout: `Previous HEAD position was refs/heads/main\nHEAD is now at ${targetHash}... Mock commit message`, stderr: '' };
      }
      if (command.startsWith('aws s3 sync') && correctHashCheckedOut) {
        // Simulate the marker file being uploaded
        return { stdout: `upload: ${markerFileName} to s3://${process.env.SITES_BUCKET}/${event.arguments.id}/${markerFileName}`, stderr: '' };
      }
      if (command.startsWith('aws resourcegroupstaggingapi get-resources')) {
        return { stdout: JSON.stringify({ ResourceTagMappingList: [{ ResourceARN: 'arn:aws:cloudfront::123456789012:distribution/EXAMPLEDEFUNXYZ' }] }), stderr: '' };
      }
      // Generic responses for other commands
      return { stdout: '', stderr: '' };
    });

    // Action
    const result = await handler(event, context, callback);

    // Assert
    expect(result).toBe(true); // Handler should succeed
    expect(execMock.mock.calls.some(call => typeof call[0] === 'string' && call[0].includes(`git checkout ${targetHash}`))).toBe(true);
    
    // Check if the marker file was part of the "changed files" for invalidation
    // Need to reconstruct how `changedFiles` is formed in the handler
    // stdout.split(/[\n\r]/).filter(...).map(...)
    // For this test, we can check if the s3 sync command (which produces changedFiles) was called
    // and trust our mock for s3 sync produced the marker file.
    // A more direct check would be to inspect the arguments to 'aws cloudfront create-invalidation'
    
    // Let's find the call to 'aws cloudfront create-invalidation'
    const cloudfrontInvalidationCall = execMock.mock.calls.find(call => call[0].startsWith('aws cloudfront create-invalidation'));
    expect(cloudfrontInvalidationCall).toBeDefined();
    if (cloudfrontInvalidationCall) {
      expect(cloudfrontInvalidationCall[0]).toContain(`${s3SyncMarkerFilePath}`);
    }
    expect(logger.error).not.toHaveBeenCalled();
    jest.resetModules(); // Clean up for other tests
  });
