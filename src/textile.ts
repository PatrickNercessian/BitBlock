import { Buckets, PrivateKey, KeyInfo, createUserAuth, Root, PushPathResult } from '@textile/hub'

//global variables
var buckets: Buckets
var bucketRoot: Root

export function newPrivateKey() {
    const identity = PrivateKey.fromRandom()
    const identityStr = identity.toString()
  
    const node = <HTMLInputElement>document.getElementById("privateKeyTextbox")
    node.value = identityStr
    localStorage.setItem("user-private-identity", identityStr)
}

export function getLocalIdentity() { // TODO shouldn't be exported
    /** Restore any cached user identity first */
    const cached = localStorage.getItem("user-private-identity")
    if (cached !== null) {
      try {
        return PrivateKey.fromString(cached)
      } catch (error) {
        console.error(error)
      }
    }
    /** No cached identity existed, so create a new one */
    const identity = PrivateKey.fromRandom()
    /** Add the string copy to the cache */
    localStorage.setItem("user-private-identity", identity.toString())
    /** Return the random identity */
    return identity
}

export async function setBucketsClient(identityStr: string) {
    //get private key
    localStorage.setItem("user-private-identity", identityStr)
  
    //get user group keys (different than private key)
    const keyInfo: KeyInfo = {
      key: "bosevj3mhjaaon36o5ljvimz2ba",
      secret: "blz5ician56o24xraiz6fyciioyktowpe2qjwsty"
    }
    
    //authenticate with keys and get token
    const auth = await createUserAuth(keyInfo.key, keyInfo.secret)
    const localBuckets = Buckets.withUserAuth(auth)
    await localBuckets.getToken(PrivateKey.fromString(identityStr))
  
    buckets = localBuckets
}

export async function uploadFile(bucketName: string, file: File, path: string): Promise<PushPathResult> {
    await setBucketRoot(bucketName)
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

async function setBucketRoot(bucketName: string) {
    const rootList = await buckets.existing()
    bucketRoot = rootList.find((root) => root.name === bucketName)
}

export async function createBucket(bucketName: string) {
    const response = await buckets.getOrCreate(bucketName)

    const readRole = new Map()
    readRole.set("*", 1)  // NA = 0, Reader = 1, Writer = 2, Admin = 3
    buckets.pushPathAccessRoles(response.root.key, "/", readRole)
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
    return await buckets.listPathFlat(bucketRoot.key, "/")
}

export function getSourceUrl(fileName: string) {
    return "https://hub.textile.io/thread/" + bucketRoot.thread + "/buckets/" + bucketRoot.key + fileName.replace(" ", "%20").substr(1)
}