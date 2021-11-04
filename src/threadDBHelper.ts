import { Client, createUserAuth, PrivateKey, ThreadID, Root } from '@textile/hub'
import { keyInfo } from './textileHelper'
import { Video } from './video'

const globalDbThreadKey = 'bafkwca5wixgwpz5eykfmksnqsxt25x3277jgciudj4tschhpqq4h5va'
const globalDbThreadName = 'GlobalDatabase'
const globalCollectionName = 'GlobalVideoDatabase'

// Define a simple person schema
const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Video',
    type: 'object',
    properties: {
        _id: { 
            type: 'string',
            description: 'The id of the video'
         },
        thread: { type: 'string' },
        bucket: { type: 'string' },
        fileName: { type: 'string' }
    },
    required: ['_id', 'thread', 'bucket', 'fileName'] 
}

async function getThreadsClient (identityStr: string) {
    const auth = await createUserAuth(keyInfo.key, keyInfo.secret)
    const client = Client.withUserAuth(auth)
    await client.getToken(PrivateKey.fromString(identityStr))

    return client
}

export async function createAppendOnlyThreadDB(identityStr: string) {
    const client = await getThreadsClient(identityStr)
    const threadId: ThreadID = await client.newDB(ThreadID.fromRandom(), globalDbThreadName)
    console.log("Created new thread: ", threadId.toString())
    
    // const writeValidator = (_write: string, event: Event, _instance: Video) => {
    //     return event.patch.type === 'create'
    // }
    const writeValidator = `return event.patch.type === "create"`

    // TODO switch to newCollectionFromObject
    await client.newCollection(threadId, {name: globalCollectionName, schema: schema, writeValidator: writeValidator})

    return threadId.toString()
}

export async function printGlobalVideoDatabaseContents(identityStr: string) {
    const client = await getThreadsClient(identityStr)
    const threadId = ThreadID.fromString(globalDbThreadKey)
    console.log('Collections:')
    console.log(await client.listCollections(threadId))
    console.log('GlobalVideoDatabase entries:')
    console.log(await client.find(threadId, globalCollectionName, {}))
}

export async function appendVideoEntry(identityStr: string, fileName: string, sourceBucketRoot: Root) {
    const client = await getThreadsClient(identityStr)
    const threadId = ThreadID.fromString(globalDbThreadKey)

    const video: Video = {
        thread: sourceBucketRoot.thread,
        bucket: sourceBucketRoot.key,
        fileName: fileName
    }
    
    client.create(threadId, globalCollectionName, [video])
}

export async function getRandomVideoEntry(identityStr: string): Promise<Video> {
    const client = await getThreadsClient(identityStr)
    const threadId = ThreadID.fromString(globalDbThreadKey)

    const videos: Video[] = await client.find(threadId, globalCollectionName, {})
    const randomIndex = Math.floor(Math.random() * videos.length)
    return videos[randomIndex]
}