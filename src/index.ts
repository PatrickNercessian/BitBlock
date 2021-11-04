import * as BucketHelper from './bucketsHelper'
import * as ThreadHelper from './threadDBHelper'
import * as TextileHelper from './textileHelper'
import * as FilecoinHelper from './filecoinHelper'


// import * as Plyr from 'plyr'

var $ = require('jquery')

function createErrorMessage(message: string, div: HTMLElement, id?: string) {
  const label = document.createElement('label')
  if (id !== undefined) {
    label.id = id
  }
  label.textContent = message
  label.setAttribute("style", "color:red")
  // div.appendChild(document.createElement("br"))
  div.appendChild(label)
}


async function checkBuckets() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).disabled = true;
  (<HTMLInputElement>document.getElementById("privateKeyBtn")).disabled = true;

  document.getElementById("addressDiv").style.display = "none"

  const identityStr = (<HTMLInputElement>document.getElementById("privateKeyTextbox")).value
  localStorage.setItem("user-private-identity", identityStr)
  await BucketHelper.setBucketsClient(identityStr)

  //add button to create a new bucket
  const createBucketBtn = document.createElement("input")
  createBucketBtn.id = "createBucketBtn"
  createBucketBtn.type = "button"
  createBucketBtn.value = "Create new Bucket"
  createBucketBtn.addEventListener("click", async function () {
    await BucketHelper.createBucket() // TODO
    await updateBucketsDisplay()
  });

  //display button
  const keyDiv = document.getElementById("keyDiv")
  if (!keyDiv.contains(document.getElementById(createBucketBtn.id))) {
    keyDiv.appendChild(createBucketBtn)
  }
  
  updateBucketsDisplay()
}

async function checkThreads() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).disabled = true;
  (<HTMLInputElement>document.getElementById("privateKeyBtn")).disabled = true;

  await ThreadHelper.printGlobalVideoDatabaseContents((<HTMLInputElement>document.getElementById("privateKeyTextbox")).value)
}

async function shuffle() {
  document.getElementById("addressDiv").style.display = "none"
  const randomVidUrl = BucketHelper.getSourceUrlFromVideo(
    await ThreadHelper.getRandomVideoEntry((<HTMLInputElement>document.getElementById("privateKeyTextbox")).value)
  )

  const videoElement = <HTMLVideoElement>document.getElementById("player")
  videoElement.src = randomVidUrl

  document.getElementById("videoDiv").style.display = "block"
}

async function checkWallets() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).disabled = true;
  (<HTMLInputElement>document.getElementById("privateKeyBtn")).disabled = true;

  const address = (await FilecoinHelper.getAddresses((<HTMLInputElement>document.getElementById("privateKeyTextbox")).value))[0]
  document.getElementById("addressPublicKey").textContent = address.address

  const filAmount = Number(address.balance * BigInt(100)/ BigInt(1000000000000000000)) / 100
  document.getElementById("addressBalance").textContent = address.balance.toString() + "attoFIL or " + filAmount.toString() + " FIL"

  document.getElementById("addressDiv").style.display = "block"
}

async function archive() {
  const archiveErrorLabel = document.getElementById("archiveError")
  if (document.contains(archiveErrorLabel)) {
    archiveErrorLabel.remove()
  }

  try {
    await BucketHelper.archiveBucket()
  } catch (error) {
    createErrorMessage(error.message, document.getElementById("bucketContentsDiv"), "archiveError")
  }
}

async function checkArchives() {
  console.log(await BucketHelper.checkBucketArchives())
}

async function createDatabase() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).disabled = true;
  (<HTMLInputElement>document.getElementById("privateKeyBtn")).disabled = true;

  // document.getElementById("orLabel").remove()
  // document.getElementById("searchBucketBtn").remove()
  // document.getElementById("searchBucketKey").remove()

  const threadId = await ThreadHelper.createAppendOnlyThreadDB((<HTMLInputElement>document.getElementById("privateKeyTextbox")).value)
}

async function updateBucketsDisplay() {
  const rootNames = await BucketHelper.getRootNames()
  const keyDiv = document.getElementById("keyDiv")

  //remove info from previous clicks
  const bucketsDiv = document.getElementById("bucketsDiv")
  if (document.contains(bucketsDiv)) 
    bucketsDiv.remove()
  const noBucketsLabel = document.getElementById("noBucketsLabel")
  if (document.contains(noBucketsLabel))
    noBucketsLabel.remove()

  //if user has existing buckets
  if (rootNames.length > 0) {
    const bucketsDiv = document.createElement("div")
    bucketsDiv.id = "bucketsDiv"
    keyDiv.appendChild(bucketsDiv)
    for (let i=0; i < rootNames.length; i++) { // Create radio buttons for each bucket
      const radio = document.createElement("input")
      radio.type = "radio"
      radio.name = "bucketChoice"
      radio.id = "bucketChoice" + (i+1)
      
      const radioLabel = document.createElement("label")
      radioLabel.htmlFor = radio.id
      radioLabel.textContent = rootNames[i]

      bucketsDiv.appendChild(radio)
      bucketsDiv.appendChild(radioLabel)
      bucketsDiv.appendChild(document.createElement("br"))
    }

  } else {
    createErrorMessage("There are no existing buckets associated with this account. Would you like to create one?", keyDiv, "noBucketsLabel")

    // const label = document.createElement('label')
    // label.id = "noBucketsLabel"
    // label.textContent = "There are no existing buckets associated with this account. Would you like to create one?"
    // label.setAttribute("style", "color:red")
    // keyDiv.appendChild(document.createElement("br"))
    // keyDiv.appendChild(label)
  }
}


async function uploadBtn() {
  const file = (<HTMLInputElement>document.getElementById("fileInput")).files[0]
  const identityStr = (<HTMLInputElement>document.getElementById("privateKeyTextbox")).value
  const fileUploadDiv = document.getElementById("fileUploadDiv")
  
  console.log(file.size + " bytes")

  if (file.type.match("video.*")) {
    if (fileUploadDiv.children.length > 4) // remove potential error label saying a non-video file was selected
      fileUploadDiv.lastElementChild.remove()

    const selectedElem = document.querySelector('input[name="bucketChoice"]:checked')
    if (selectedElem) {
      console.log('File:')
      console.log(file)
      const bucketName = document.querySelector("label[for=" + selectedElem.id + "]").textContent
      
      // const pushPathResult = await buckets.pushPath(bucketRoot.key, "/" + file.name, file.stream())
      const pushPathResult = await BucketHelper.uploadFile(identityStr, bucketName, file, "/" + file.name)

      console.log('Push Path Result:')
      console.log(pushPathResult)
      displayBucketContents(bucketName)
    }
  } else {
    fileUploadDiv.appendChild(document.createElement('br'))

    createErrorMessage("You must select a video file", document.getElementById("fileUploadDiv"))

    // const error = document.createElement('label')
    // error.textContent = "You must select a video file"
    // error.setAttribute("style", "color:red")
    // document.getElementById("fileUploadDiv").appendChild(error)
  }
}


async function displayBucketContents(bucketName: string) {
  var bucketContentsDiv = document.getElementById("bucketContentsDiv")
  if (document.contains(bucketContentsDiv))
    bucketContentsDiv.remove()
  bucketContentsDiv = document.createElement("div")
  bucketContentsDiv.id = "bucketContentsDiv"
  bucketContentsDiv.style.textAlign = "center"

  document.body.insertBefore(bucketContentsDiv, document.getElementById("videoDiv"))  //TODO is there a better way to do this?

  const archiveBtn = document.createElement("input")
  archiveBtn.type = "button"
  archiveBtn.id = "archiveBtn"
  archiveBtn.value = "Archive"
  archiveBtn.addEventListener("click", archive)
  
  const checkBucketArchivesBtn = document.createElement("input")
  checkBucketArchivesBtn.type = "button"
  checkBucketArchivesBtn.id = "checkBucketArchivesBtn"
  checkBucketArchivesBtn.value = "Check Bucket Archives"
  checkBucketArchivesBtn.addEventListener("click", checkArchives)

  bucketContentsDiv.append(archiveBtn, checkBucketArchivesBtn, document.createElement("br"))

  const paths = await BucketHelper.getPaths(bucketName)
  var isBucketEmpty = true;
  for (let i = 0; i < paths.length; i++) {
    if (!paths[i].startsWith("//.")) {
      isBucketEmpty = false;

      const radio = document.createElement("input")
      radio.type = "radio"
      radio.name = "fileChoice"
      radio.id = "fileChoice" + (i+1)
      
      const radioLabel = document.createElement("label")
      radioLabel.htmlFor = radio.id
      radioLabel.textContent = paths[i]

      bucketContentsDiv.appendChild(radio)
      bucketContentsDiv.appendChild(radioLabel)
      bucketContentsDiv.appendChild(document.createElement("br"))
    }
  }

  if (isBucketEmpty) {
    createErrorMessage("This Bucket is empty.", document.getElementById("bucketContentsDiv"))

    // const error = document.createElement('label')
    // error.textContent = "This Bucket is empty."
    // error.setAttribute("style", "color:red")
    // document.getElementById("bucketContentsDiv").appendChild(error)
  }
}


function initialize() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).value = TextileHelper.getLocalIdentity().toString()

  document.getElementById("privateKeyBtn").addEventListener("click", TextileHelper.newPrivateKey)
  document.getElementById("checkBucketsBtn").addEventListener("click", checkBuckets)
  document.getElementById("checkThreadsBtn").addEventListener("click", checkThreads)
  document.getElementById("shuffleBtn").addEventListener("click", shuffle)
  document.getElementById("checkWalletsBtn").addEventListener("click", checkWallets)
  document.getElementById("createDatabaseBtn").addEventListener("click", createDatabase)
  
  document.addEventListener('click', async function (event) {
    if (event.target && event.target instanceof HTMLInputElement && event.target.type === "radio") {
      if (event.target.name === "bucketChoice") {
        document.getElementById("uploadBtn").addEventListener("click", uploadBtn)
        document.getElementById("fileUploadDiv").style.display = "block"

        const bucketName = document.querySelector("label[for=" + event.target.id + "]").textContent
        displayBucketContents(bucketName)
      } else if (event.target.name === "fileChoice") {
        const fileName = document.querySelector("label[for=" + event.target.id + "]").textContent
        const sourceStr = BucketHelper.getSourceUrl(fileName)

        const videoElement = <HTMLVideoElement>document.getElementById("player")
        videoElement.src = sourceStr

        document.getElementById("videoDiv").style.display = "block"
        // const player = new Plyr("#player")
        // player.source = 
      }
    }
  });
}

initialize()