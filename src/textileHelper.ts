import { PrivateKey, KeyInfo } from '@textile/hub'

//get user group keys (different than private key)
export const keyInfo: KeyInfo = {
    key: "bosevj3mhjaaon36o5ljvimz2ba",
    secret: "blz5ician56o24xraiz6fyciioyktowpe2qjwsty"
}


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