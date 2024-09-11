let canvas = document.getElementById("canvas")
let context = canvas.getContext("2d")
context.imageSmoothingEnabled = false

let partsImg = new Image() 
partsImg.src = "discparts.png"

let layerStackDiv = document.getElementById("layer-stack")
let layerStack = new LayerStack()

let overlayDiv = document.getElementById("overlays")
let commandDiv = document.getElementById("command-box")
let itemDiv = document.getElementById("item-box")
let fileName = document.getElementById("track-filename")
let upload = document.getElementById("file-upload")
let resourceBtn = document.getElementById("res-btn")

let ffmpeg = null;

var makingResources = false
var trackName = ""
var hash = ""



async function init() {

    document.getElementById("download-btn").onclick = saveImage
    document.getElementById("title-box").onchange = updateCommand
    document.getElementById("artist-box").onchange = updateCommand
    document.getElementById("data-btn").onclick = downloadData
    
    resourceBtn.onclick = downloadResources

    let bg = layerStack.addLayer(0)
    bg.setColor([ 0.318, 0.318, 0.318 ])

    let center = layerStack.addLayer(1)
    center.setColor([ 1.00, 1.00, 1.00 ])

    layerStackDiv.appendChild(bg.generateLayerDiv("Background", false))
    layerStackDiv.appendChild(center.generateLayerDiv("Center", false))

    layerStack.updateCallback = () => {
        layerStack.render(context, canvas.width, 0)
    }

    layerStack.render(context, canvas.width, 0)

    for(let i = 2 ; i < 24 ; i++) {
        addOverlay(i)
    }
    
    upload.addEventListener("change", fileChanged)
    
    ffmpeg = new ff.FFmpeg();
    try {
        await ffmpeg.load({
            coreURL: `${window.location.origin}/ffmpeg/core/ffmpeg-core.js`,
            wasmURL: `${window.location.origin}/ffmpeg/core/ffmpeg-core.wasm`
        })
    } catch(e) {
        console.log("Unable to load FFmpeg!")
        throw e
    }
}

function addLayer(index) {
    let layer = layerStack.addLayer(index)
    out = layer.id
    layerStackDiv.appendChild(layer.generateLayerDiv("Overlay-" + index, true))
    layerStack.render(context, canvas.width, 0)

    return out
}

function removeLayer(id) {
    layerStackDiv.removeChild(document.getElementById(id))
    layerStack.removeLayer(id)
    layerStack.render(context, canvas.width, 0)
}

function addOverlay(index) {

    let div = document.createElement("div")
    div.classList.add("overlay")
    div.classList.add("btn")

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = "45"
    overlayCanvas.height = "45"

    let overlayContext = overlayCanvas.getContext('2d')
    overlayContext.imageSmoothingEnabled = false;

    let part = new ImagePart(index)

    part.renderTo(overlayContext, 48, 0)

    div.appendChild(overlayCanvas)
    div.onclick = () => {
        addLayer(index)
    }

    overlayDiv.appendChild(div)
}


function saveImage() {

    let download = document.createElement("a")
    download.setAttribute("download", "disc.png")

    let canvas = document.createElement("canvas")
    canvas.width = 16
    canvas.height = 16

    layerStack.render(canvas.getContext("2d"), 16, 0)

    let canvasData = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream")

    download.setAttribute("href", canvasData)
    download.click()
}

async function generatePackIcon() {
    let canvas = document.createElement("canvas")
    canvas.width = 128
    canvas.height = 128

    ctx = canvas.getContext("2d")
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = "#000000"
    ctx.fillRect(0,0,128,128)

    layerStack.render(ctx, 112, 12)

    return await new Promise(resolve => canvas.toBlob(resolve));
}

function updateCommand() {

    trackName = document.getElementById("title-box").value
    if(trackName.length == 0) {
        hash = ""
    }

    let artist = document.getElementById("artist-box").value
    if(artist.length > 0) {
        trackName = artist + " - " + trackName
    }

    hash = cyrb53(trackName)

    commandDiv.innerHTML = `<p>/give @s minecraft:music_disc_cat[minecraft:item_model="discmaker:${hash}",minecraft:jukebox_playable={song:"discmaker:${hash}"}]</p>`
    itemDiv.innerHTML = `<p>{"id":"minecraft:music_disc_cat","count":1,"components":{"minecraft:item_model":"discmaker:${hash}","minecraft:jukebox_playable": { "song": "discmaker:${hash}" }}}`

}

function fileChanged(event) {
    
    fileName.innerText = event.target.files[0].name

}

async function downloadData() {
    
    if(trackName.length == 0 || hash.length == 0) {
        alert("Track name must be set!")
        return
    }

    let compLevel = document.getElementById("comp-box").value
    
    const { name } = upload.files[0];
    try {
        ffmpeg.writeFile(name, await ff.fetchFile(upload.files[0]))
    } catch(e) {
        console.log("Unable to write file!")
        throw e
    }
    
    duration = 300
    ffmpeg.on("log", ({ message }) => {
        duration = message
    })

    try {
        await ffmpeg.ffprobe(['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'default=noprint_wrappers=1:nokey=1', name])
    } catch(e) {
        console.log("Unable to probe file!")
        throw e
    }

    var zip = new JSZip()
    zip.file("pack.mcmeta", `{"pack":{"pack_format":${DATA_PACK_VERSION},"description":"DiscMaker Data: ${trackName}"}}`)

    zip.folder("data")
        .folder("discmaker")
        .folder("jukebox_song")
        .file(`${hash}.json`, `{"comparator_output":${compLevel},"description":{"translate":"record.discmaker.${hash}"},"length_in_seconds":${duration},"sound_event":{"sound_id":"discmaker:music_disc.${hash}"}}`)

    zip.generateAsync({type:"base64"}).then(b64 => {
        
        let download = document.createElement("a")
        download.setAttribute("download", `${trackName} [DiscMaker Data].zip`)
        
        download.setAttribute("href", `data:application/zip;base64,${b64}`)
        download.click()
    })

}

async function downloadResources() {

    const stopMakingResources = function() {
        resourceBtn.classList.remove("box")
        makingResources = false
    }

    if(makingResources) {
        alert("A resource pack is already being made. Please wait...")
        return
    }
    

    if(trackName.length == 0 || hash.length == 0) {
        alert("Track name must be set!")
        return
    }
    
    resourceBtn.classList.add("box")
    makingResources = true

    try {
        let canvas = document.createElement("canvas")
        canvas.width = 16
        canvas.height = 16
    
        layerStack.render(canvas.getContext("2d"), 16, 0)
        blob = await new Promise(resolve => canvas.toBlob(resolve));
    
        const { name } = upload.files[0];
        try {
            ffmpeg.writeFile(name, await ff.fetchFile(upload.files[0]))
        } catch(e) {
            console.log("Unable to write file!")
            makingResources = false
            throw e
        }
        
        let fileName = `${hash}.ogg`
        try {
            await ffmpeg.exec(['-i', name, '-map', '0:a', '-ac', '1', '-c:a', 'libvorbis', fileName])
        } catch(e) {
            console.log("Unable to transcode file!")
            makingResources = false
            throw e
        }
    
        var zip = new JSZip()
        zip.file("pack.mcmeta", `{"pack":{"pack_format":${RESOURCE_PACK_VERSION},"description":"DiscMaker Resources: ${trackName}"}}`)
        zip.file("pack.png", generatePackIcon())
    
        var assetsDir = zip.folder("assets")
        
        var discmakerDir = assetsDir.folder("discmaker")
        var langDir = discmakerDir.folder("lang")
        var texturesDir = discmakerDir.folder("textures").folder("item")
        var modelsDir = discmakerDir.folder("models").folder("item")
        var recordsDir = discmakerDir.folder("sounds").folder("records")
    
    
        langDir.file("en_us.json", `{"record.discmaker.${hash}":"${trackName}"}`)
    
        try {
            recordsDir.file(fileName, await ffmpeg.readFile(fileName))
        } catch(e) {
            console.log("Unable to read file!")
            makingResources = false
            throw e
        }
        texturesDir.file(`${hash}.png`, blob)
    
        discmakerDir.file("sounds.json", `{"music_disc.${hash}":{"sounds":[{"name":"discmaker:records/${hash}","stream":true}]}}`)
        modelsDir.file(`${hash}.json`, `{"parent":"minecraft:item/template_music_disc","textures":{"layer0":"discmaker:item/${hash}"}}`)
    
        zip.generateAsync({type:"base64"}).then(b64 => {
        
            let download = document.createElement("a")
            download.setAttribute("download", `${trackName} [DiscMaker Resources].zip`)
            
            download.setAttribute("href", `data:application/zip;base64,${b64}`)
            download.click()
            
            stopMakingResources()
        })
    } catch(e) {
        stopMakingResources()
    }
    


}