import { Buckets, PrivateKey, createUserAuth, Root, PushPathResult, ArchiveConfig } from '@textile/hub'
import { appendVideoEntry } from './threadDBHelper'
import { keyInfo } from './textileHelper'
import { Video } from './video'

//global variables
var buckets: Buckets
var bucketRoot: Root

export async function setBucketsClient(identityStr: string) {
    //authenticate with keys and get token
    const auth = await createUserAuth(keyInfo.key, keyInfo.secret)
    const localBuckets = Buckets.withUserAuth(auth)
    await localBuckets.getToken(PrivateKey.fromString(identityStr))
  
    buckets = localBuckets
}

async function setBucketRoot(bucketName: string) {
    const rootList = await buckets.existing()
    bucketRoot = rootList.find((root) => root.name === bucketName)
}

export async function uploadFile(identityStr: string, bucketName: string, file: File, path: string): Promise<PushPathResult> {
    await setBucketRoot(bucketName)

    //create a new bucket if this bucket is archived
    const archives = await checkBucketArchives()
    if (archives.current !== undefined) {
        createBucket()
    }

    appendVideoEntry(identityStr, file.name, bucketRoot)
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onabort = () => reject('file reading was aborted')
        reader.onerror = () => reject('file reading has failed')
        reader.onload = () => {
        const binaryStr = reader.result
        // Finally, push the full file to the bucket
        buckets.pushPath(bucketRoot.key, path, binaryStr).then((raw) => {
            resolve(raw)
        })
        }
        reader.readAsArrayBuffer(file)
    })
}

export function archiveBucket(): Promise<void> {
    const archiveConfig: ArchiveConfig = {
        "repFactor": 1,
        "dealMinDuration": 518400,
        "excludedMiners": null,
        "trustedMiners": [
          "f0101087"
        ],
        "countryCodes": null,
        "renew": {
          "enabled": false,
          "threshold": 0
        },
        // "maxPrice": 100,000,000,000,
        "maxPrice": 100000000,
        "fastRetrieval": true,
        "dealStartOffset": 8640,
        "verifiedDeal": false
      }
    return buckets.archive(bucketRoot.key, { archiveConfig }, false)
}

export function checkBucketArchives() {
    return buckets.archives(bucketRoot.key)
}

export async function createBucket() {
    const rootNames = await getRootNames()
    var bucketName = 'Bucket 1'

    //Increment name if bucket already exists
    for (const rootName of rootNames) {
        if (rootName === bucketName) {
            bucketName = "Bucket " + (parseInt(bucketName.substr(bucketName.indexOf(' ')+1)) + 1)
        }
    }

    const response = await buckets.getOrCreate(bucketName)
    bucketRoot = response.root

    const readRole = new Map()
    readRole.set("*", 1)  // NA = 0, Reader = 1, Writer = 2, Admin = 3
    await buckets.pushPathAccessRoles(bucketRoot.key, "/", readRole)
}

export async function getRootNames(): Promise<string[]> {
    const rootList = await buckets.existing()
    const rootNames: string[] = []
    rootList.forEach(function(root) {
        rootNames.push(root.name)
    })
    return rootNames
}

export async function getPaths(bucketName: string): Promise<string[]> {
    await setBucketRoot(bucketName)
    console.log(bucketRoot)
    console.log(await buckets.pullPathAccessRoles(bucketRoot.key, "/"))
    return buckets.listPathFlat(bucketRoot.key, "/")
}

export function getSourceUrl(fileName: string) {
    return "https://hub.textile.io/thread/" + bucketRoot.thread 
        + "/buckets/" + bucketRoot.key 
        + fileName.replace(" ", "%20").substr(1)
}

export function getSourceUrlFromVideo(video: Video): string {
    return "https://hub.textile.io/thread/" + video.thread 
         + "/buckets/" + video.bucket + "/"
         + video.fileName.replace(" ", "%20")
}



