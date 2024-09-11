const rgbToHex = function(rgb) {

    let channel = function(c) {

        corrected = Math.floor(Math.min(c * 255, 255))

        let out = corrected.toString(16)
        if(out.length < 2) {
            out = "0" + out
        }
        return out
    }

    return "#" + channel(rgb[0]) + channel(rgb[1]) + channel(rgb[2])
}

const hexToRgb = function(hex) {
    if(hex.startsWith("#")) {
        hex = hex.substring(1)
    }
    if(hex.length != 6) {
        return [ 0, 0, 0 ]
    }
    let r = parseInt(hex.substring(0,2), 16)
    let g = parseInt(hex.substring(2,4), 16)
    let b = parseInt(hex.substring(4,6), 16)

    return [ r / 255.0, g / 255.0, b / 255.0 ]
}

// From https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
const cyrb53 = function(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

function createFilter(id, tint, parent) {

    old = document.getElementById("flt-" + id)
    if(old != null) parent.removeChild(old)

    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("id", "flt-" + id)
    
    let filter = document.createElementNS("http://www.w3.org/2000/svg", "filter")
    filter.setAttribute("id", id)
    filter.setAttribute("color-interpolation-filters", "sRGB")
    filter.setAttribute("x", "0")
    filter.setAttribute("y", "0")
    filter.setAttribute("width", "100%")
    filter.setAttribute("height", "100%")
    
    let matrix = `${tint[0]} 0 0 0 0 ` +
                 `0 ${tint[1]} 0 0 0 ` +
                 `0 0 ${tint[2]} 0 0 ` +
                 `0 0 0 1 0 `

    let colorMatrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix")
    colorMatrix.setAttribute("type", "matrix")
    colorMatrix.setAttribute("values", matrix)

    filter.appendChild(colorMatrix)
    svg.appendChild(filter)
    parent.appendChild(svg)
}



const ImagePart = class {

    constructor(index) {
        this.offset = index * 16
        this.color = [1.00, 1.00, 1.00]
    }

    renderTo(context, size, canvas_offset) {

        createFilter("part", this.color, document.getElementsByTagName("body")[0])

        context.filter = "url(\"#part\")"
        context.drawImage(partsImg, 0, this.offset, 16, 16, canvas_offset, canvas_offset, size, size)
    }
}


var current_layer = 0
const Layer = class {

    constructor(index) {
        
        this.image = new ImagePart(index)
        this.id = "layer-" + current_layer
        this.updateCallback = () => { }

        current_layer++
    }

    render(context, size, canvas_offset) {
        this.image.renderTo(context, size, canvas_offset)
    }

    setColor(color) {
        this.image.color = color
    }

    generateLayerDiv(name, allowDelete) {
        let layer = document.createElement("div")
        layer.setAttribute("id", this.id)
        layer.classList.add("layer")

        let contents = document.createElement("div")
        contents.classList.add("layer-contents")
        contents.classList.add("box")

        let canvas = document.createElement("canvas")
        canvas.width = "32"
        canvas.height = "32"

        let context = canvas.getContext("2d")
        context.imageSmoothingEnabled = false

        let span = document.createElement("span")
        span.innerText = name

        let picker = document.createElement("input")
        picker.type = "color"
        picker.value = rgbToHex(this.image.color)

        picker.addEventListener("change", (event) => {
            this.setColor(hexToRgb(event.target.value))
            this.render(context, 32, 0)
            this.updateCallback()
        })

        let controls = document.createElement("div")
        controls.classList.add("layer-controls")
        controls.appendChild(picker)

        contents.appendChild(canvas)
        contents.appendChild(span)
        contents.appendChild(controls)

        layer.appendChild(contents)

        if(allowDelete) {

            let controls = document.createElement("div")
            controls.classList.add("layer-controls")
            controls.classList.add("btn")
            controls.innerText = "X"

            controls.onclick = () => {
                removeLayer(this.id)
            }

            layer.appendChild(controls)
        }
        
        this.render(context, 32, 0)
        return layer
    }
}

const LayerStack = class {
    
    constructor() {
        this.layers = []
        this.updateCallback = () => {}
    }

    addLayer(index) {
        let out = new Layer(index)
        out.updateCallback = () => {
            this.updateCallback()
        }

        this.layers.push(out)
        return out
    }

    removeLayer(id) {
        var idx = 0
        for(var i in this.layers) {
            var layer = this.layers[i]
            if(layer.id == id) {
                this.layers.splice(idx, 1)
                break;
            }
            idx++
        }
    }

    render(context, size, canvas_offset) {
        this.layers.forEach((layer) => {
            layer.render(context, size, canvas_offset)
        })
    }
}

const RESOURCE_PACK_VERSION = 38
const DATA_PACK_VERSION = 53