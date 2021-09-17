import { Buckets, PrivateKey, KeyInfo, createUserAuth, Root, PushPathResult } from '@textile/hub'
import * as TextileHelper from './textile'
// import * as Plyr from 'plyr'

var $ = require('jquery')


async function checkBuckets() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).disabled = true;
  (<HTMLInputElement>document.getElementById("privateKeyBtn")).disabled = true;

  // document.getElementById("orLabel").remove()
  // document.getElementById("searchBucketBtn").remove()
  // document.getElementById("searchBucketKey").remove()

  await TextileHelper.setBucketsClient((<HTMLInputElement>document.getElementById("privateKeyTextbox")).value)

  //add button to create a new bucket
  const createBucketBtn = document.createElement("input")
  createBucketBtn.id = "createBucketBtn"
  createBucketBtn.type = "button"
  createBucketBtn.value = "Create new Bucket"
  createBucketBtn.addEventListener("click", async function () {
    TextileHelper.createBucket("TODO") // TODO
    updateBucketsDisplay()
  });

  //display button
  const keyDiv = document.getElementById("keyDiv")
  if (!keyDiv.contains(document.getElementById(createBucketBtn.id))) {
    keyDiv.appendChild(createBucketBtn)
  }
  
  updateBucketsDisplay()
}


async function updateBucketsDisplay() {
  const rootNames = await TextileHelper.getRootNames()
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
    const label = document.createElement('label')
    label.id = "noBucketsLabel"
    label.textContent = "There are no existing buckets associated with this account. Would you like to create one?"
    label.setAttribute("style", "color:red")
    keyDiv.appendChild(document.createElement("br"))
    keyDiv.appendChild(label)
  }
}


async function uploadBtn() {
  const file = (<HTMLInputElement>document.getElementById("fileInput")).files[0]
  const fileUploadDiv = document.getElementById("fileUploadDiv")
  
  console.log(file.size + " bytes")

  if (file.type.match("video.*")) {
    if (fileUploadDiv.children.length > 4) // remove potential error label saying a non-video file was selected
      fileUploadDiv.lastElementChild.remove()

    const selectedElem = document.querySelector('input[name="bucketChoice"]:checked')
    if (selectedElem) {
      console.log(file)
      const bucketName = document.querySelector("label[for=" + selectedElem.id + "]").textContent
      console.log(bucketName)
      
      // const pushPathResult = await buckets.pushPath(bucketRoot.key, "/" + file.name, file.stream())
      const pushPathResult = await TextileHelper.uploadFile(bucketName, file, "/" + file.name)
      console.log(pushPathResult)
      displayBucketContents(bucketName)
    }
  } else {
    fileUploadDiv.appendChild(document.createElement('br'))

    const error = document.createElement('label')
    error.textContent = "You must select a video file"
    error.setAttribute("style", "color:red")
    document.getElementById("fileUploadDiv").appendChild(error)
  }
}

// async function searchBucket() {
//   (<HTMLInputElement>document.getElementById("privateKeyTextbox")).disabled = true;
//   (<HTMLInputElement>document.getElementById("privateKeyBtn")).disabled = true;

//   document.getElementById("checkBucketsBtn").remove()
//   document.getElementById("orLabel").remove()

//   buckets = await getBucketsClient((<HTMLInputElement>document.getElementById("privateKeyTextbox")).value)
//   const bucketKey = (<HTMLInputElement>document.getElementById("searchBucketKey")).value
//   console.log(bucketKey)
//   console.log(await buckets.existing())
//   // const root = await buckets.root(bucketKey)
//   const pathFlat = await buckets.listPathFlat(bucketKey,  '/')
//   console.log(pathFlat)
// }


async function displayBucketContents(bucketName: string) {
  var bucketContentsDiv = document.getElementById("bucketContentsDiv")
  if (document.contains(bucketContentsDiv))
    bucketContentsDiv.remove()
  bucketContentsDiv = document.createElement("div")
  bucketContentsDiv.id = "bucketContentsDiv"
  bucketContentsDiv.style.textAlign = "center"

  document.body.insertBefore(bucketContentsDiv, document.getElementById("videoDiv"))

  const paths = await TextileHelper.getPaths(bucketName)
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
    const error = document.createElement('label')
    error.textContent = "This Bucket is empty."
    error.setAttribute("style", "color:red")
    document.getElementById("bucketContentsDiv").appendChild(error)
  }
}


function initialize() {
  (<HTMLInputElement>document.getElementById("privateKeyTextbox")).value = TextileHelper.getLocalIdentity().toString()

  document.getElementById("privateKeyBtn").addEventListener("click", TextileHelper.newPrivateKey)
  document.getElementById("checkBucketsBtn").addEventListener("click", checkBuckets)
  // document.getElementById("searchBucketBtn").addEventListener("click", searchBucket)
  
  //if a bucketChoice radio button is clicked
  document.addEventListener('click', async function (event) {
    if (event.target && event.target instanceof HTMLInputElement && event.target.type === "radio") {
      if (event.target.name === "bucketChoice") {
        document.getElementById("uploadBtn").addEventListener("click", uploadBtn)
        document.getElementById("fileUploadDiv").style.display = "block"

        const bucketName = document.querySelector("label[for=" + event.target.id + "]").textContent
        displayBucketContents(bucketName)
      } else if (event.target.name === "fileChoice") {
        const fileName = document.querySelector("label[for=" + event.target.id + "]").textContent
        const sourceStr = TextileHelper.getSourceUrl(fileName)

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