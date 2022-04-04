import Web3 from 'web3'
import MetaMaskOnboarding from '@metamask/onboarding'


export function installMetamask() {
    const onboarding = new MetaMaskOnboarding()
    onboarding.startOnboarding()
}

export async function connectToMetamask(provider) {
    try {
        await provider.request({ method: 'eth_requestAccounts' })
    } catch (error) {
        console.error(error)
    }
}