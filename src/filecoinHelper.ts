import { Filecoin, createUserAuth, PrivateKey } from '@textile/hub'
import { keyInfo } from './textileHelper'

export async function getAddresses(identityStr: string) {
    //authenticate with keys and get token
    const auth = await createUserAuth(keyInfo.key, keyInfo.secret)
    const filecoin = Filecoin.withUserAuth(auth)
    await filecoin.getToken(PrivateKey.fromString(identityStr))

    return filecoin.addresses()
}