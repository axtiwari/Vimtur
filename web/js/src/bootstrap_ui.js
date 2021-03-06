const socket = io();

const appData = {
    tags: [],
    imageSet: {
        current: 0,
        map: [],
        galleryOffset: 0
    },
    socket: socket
};

function getMap() {
    if (appData.imageSet.shuffleMap) {
        return appData.imageSet.shuffleMap;
    }
    return appData.imageSet.map;
}

const ui = {
    imagePanel: null,
    videoPanel: null,
    hls: null,
    type: "still"
};

function showLoadingModal() {
    showModal("#loadingModal");
}

function hideLoadingModal() {
    hideModal("#loadingModal");
}

ui.videoPanel = document.getElementById("videoPanel");
ui.hls = new Hls();
ui.hls.attachMedia(ui.videoPanel);
ui.imageElement = document.getElementById("imagePanel");
ui.imageElement.onload = hideLoadingModal;

ui.setType = function (image) {
    let type = image.type;
    ui.imageElement.src = '#';

    if (ui.type != type) {
        ui.videoPanel.style.display = 'none';
        ui.imageElement.style.display = 'none';
    }

    if (type == 'video') {
        ui.hls.detachMedia();
        ui.hls = new Hls();
        ui.hls.on(Hls.Events.MANIFEST_PARSED, function() {
            if (!isMobile()) {
                ui.videoPanel.play();
                hideLoadingModal();
            }
        });
        ui.hls.attachMedia(ui.videoPanel);
        ui.videoPanel.style.display = 'block';
        ui.hls.loadSource(`/cache/${appData.currentImage.hash}/index.m3u8`);
    } else if (type == 'gif' || type == 'still') {
        showLoadingModal();
        ui.imageElement.style.display = 'block';
        ui.imageElement.src = `/api/images/${appData.currentImage.hash}/file`;
    }
    ui.type = type;
};

function getImageTitle(image) {
    let title = '';
    if (image.metadata) {
        const elements = [];
        const metadata = image.metadata;
        if (metadata.artist) {
            elements.push(metadata.artist);
            document.getElementById("artistMetadata").value = metadata.artist;
        } else {
            document.getElementById("artistMetadata").value = "";
        }
        if (metadata.album) {
            elements.push(metadata.album);
            document.getElementById("albumMetadata").value = metadata.album;
        } else {
            document.getElementById("albumMetadata").value = "";
        }
        if (metadata.title) {
            elements.push(metadata.title);
            document.getElementById("titleMetadata").value = metadata.title;
        } else {
            document.getElementById("titleMetadata").value = "";
        }
        for (let i = 0; i < elements.length; i++) {
            title = `${title}${i > 0 ? ' / ' : ''}${elements[i]}`;
        }
    }
    if (!title) {
        title = image.path;
    } else {
        title = `${title} - ${decodeURIComponent(appData.currentImage.path)}`;
    }
    return title;
}

function updateTitle() {
    document.title = `Vimtur [${appData.imageSet.current + 1}/${getMap().length}] (${getImageTitle(appData.currentImage)})`;
}

const GALLERY_COUNT = 24;
async function updateGallery() {
    const pageNum = document.getElementById("galleryPageNumber");
    pageNum.innerHTML = `${Math.floor(appData.imageSet.galleryOffset / GALLERY_COUNT) + 1} of ${Math.ceil(getMap().length / GALLERY_COUNT)}`;
    for (let i = 0; i < GALLERY_COUNT; i++) {
        const thumbnail = document.getElementById(`thumb${i}`);
        const caption = document.getElementById(`thumbCaption${i}`);
        console.log(caption);
        const url = thumbnail.parentNode;
        url.title = "";
        let index = appData.imageSet.galleryOffset + i;
        if (index >= getMap().length) {
            url.onclick = function() {};
            thumbnail.style.display = 'none';
            caption.innerHTML = '';
        } else {
            const hash = getMap()[index];
            thumbnail.src = `/cache/thumbnails/${hash}.png`;
            thumbnail.style.display = 'block';
            url.onclick = function() {
                const clickedIndex = getMap().indexOf(hash);
                if (clickedIndex >= 0) {
                    appData.imageSet.current = clickedIndex;
                    imageCallbacks.updateImage();
                } else {
                    showMessage('Clicked image not found in current set');
                }
                $('#galleryModal').modal('hide');
            }

            const promise = request(`/api/images/${hash}`);
            promise.catch(function(err) {
                showMessage('Error updating media');
                console.log(err);
            });
            promise.then(function(metadata) {
                url.title = getImageTitle(metadata);
                switch (metadata.type) {
                    case 'video':
                        caption.innerHTML = 'Video';
                        break;
                    case 'gif':
                        caption.innerHTML = 'Gif';
                        break;
                    case 'still':
                        caption.innerHTML = 'Still';
                        break;
                    default:
                        caption.innerHTML = "";
                        break;
                }
            });
        }
    }
}

function galleryPrevious() {
    appData.imageSet.galleryOffset -= GALLERY_COUNT;
    if (appData.imageSet.galleryOffset < 0) {
        appData.imageSet.galleryOffset = 0;
    }
    updateGallery();
}

function galleryNext() {
    appData.imageSet.galleryOffset += GALLERY_COUNT;
    if (appData.imageSet.galleryOffset >= getMap().length) {
        appData.imageSet.galleryOffset = getMap().length - 1;
    }
    updateGallery();
}

function openGallery() {
    appData.imageSet.galleryOffset = appData.imageSet.current;
    updateGallery();
}

const imageCallbacks = {
    updateImage: async function() {
        try {
            appData.currentImage = await request(`/api/images/${getMap()[appData.imageSet.current]}`);
            ui.videoPanel.pause();
            ui.setType(appData.currentImage);
            setChecked(appData.currentImage.tags);
            updateTitle();
            updateState();
        } catch (err) {
            showMessage('Error in updateImage callback');
            console.log(err);
        }
    },
    next: function () {
        if (isGalleryVisible()) {
            galleryNext();
        } else {
            appData.imageSet.current++;
            if (appData.imageSet.current >= getMap().length) {
                appData.imageSet.current = 0;
            }
            imageCallbacks.updateImage();
        }
    },
    previous: function () {
        if (isGalleryVisible()) {
            galleryPrevious();
        } else {
            appData.imageSet.current--;
            if (appData.imageSet.current < 0) {
                appData.imageSet.current = getMap().length - 1;
            }
            imageCallbacks.updateImage();
        }
    }
};

async function deleteTag() {
    let result = await BootBox.prompt("Please enter the name of the tag to remove");
    if (result == null) {
        return;
    }
    if (!result) {
        showMessage('Tag name invalid');
        return;
    }
    if (!appData.tags.includes(result)) {
        showMessage('Tag does not exist');
        return;
    }
    const confirmation = await BootBox.confirm(`Are you sure you want to remove the tag '${result}'. This is irreversible.`);
    if (confirmation) {
        appData.tags = await request(`/api/tags/remove/${result}`);
        setTags(appData.tags, tagCallback);
        await imageCallbacks.updateImage();
    }
}

function isGalleryVisible() {
    return document.getElementById('galleryModal').style.display != 'none';
}

window.addEventListener("keydown", function(e) {
    if (document.activeElement.tagName.toLowerCase() == 'textarea') {
        return;
    }
    if (document.activeElement.tagName.toLowerCase() == 'input') {
        if (document.activeElement.type != 'checkbox') {
            return;
        }
    }
    if (e.key == "ArrowRight") {
        imageCallbacks.next();
    } else if (e.key == "ArrowLeft") {
        imageCallbacks.previous();
    } else if (e.key == "Delete") {
        deleteCurrent();
    }
}, false);

let startx = 0;
let dist = 0;
document.body.addEventListener('touchstart', function(e){
    const touchobj = e.changedTouches[0]; // reference first touch point (ie: first finger)
    startx = parseInt(touchobj.clientX); // get x position of touch point relative to left edge of browser
}, false);

document.body.addEventListener('touchend', function(e){
    var touchobj = e.changedTouches[0]; // reference first touch point for this event
    dist = parseInt(touchobj.clientX) - startx;
    if (dist < -100) {
        imageCallbacks.next();
        e.preventDefault();
    } else if (dist > 100) {
        imageCallbacks.previous();
        e.preventDefault();
    }
}, false);

async function simpleSearch() {
    const text = document.getElementById("simpleSearchText").value;
    if (!text) {
        console.log("Search box empty");
        return false;
    }
    const constraints = {};
    if (text.includes('|') || text.includes('&') || text.includes('(') ||
            text.includes(')') || text.includes('!')) {
        console.log("Doing lex search");
        constraints.generalLexer = text;
    } else {
        console.log("Doing keyword search");
        constraints.keywordSearch = text;
    }
    try {
        const subset = await getSubset(constraints);
        if (subset.length > 0) {
            appData.imageSet.current = 0;
            if (appData.currentImage) {
                const index = subset.indexOf(appData.currentImage.hash);
                if (index >= 0) {
                    appData.imageSet.current = index;
                }
            }
            appData.imageSet.map = subset;
            appData.imageSet.seed = null
            appData.imageSet.shuffleMap = null;
            imageCallbacks.updateImage();
        } else {
            showMessage("No media matching search criteria");
        }
    } catch (err) {
        console.log(err);
        showMessage('Error making search request');
    }
    return false;
}

function toggleTagsAndUpdate() {
    toggleTags();
    if (appData.currentImage) {
        setChecked(appData.currentImage.tags);
    }
}

function shuffle() {
    appData.imageSet.seed = Math.random();
    const hash = getMap()[appData.imageSet.current];
    appData.imageSet.shuffleMap = shuffleArray(appData.imageSet.map.slice(0), appData.imageSet.seed);
    gotoInternal(hash);
}

function unshuffle() {
    const hash = getMap()[appData.imageSet.current];
    appData.imageSet.shuffleMap = null;
    appData.imageSet.seed = null;
    gotoInternal(hash);
}

async function viewFolder() {
    try {
        const newMap = await getSubset({ folder: getMap()[appData.imageSet.current] });
        const index = newMap.indexOf(getMap()[appData.imageSet.current]);
        appData.imageSet.current = index;
        appData.imageSet.map = newMap;
        appData.imageSet.shuffleMap = null;
        appData.imageSet.seed = null;
        imageCallbacks.updateImage();
    } catch (err) {
        showMessage('Error during viewFolder call');
        console.log(err);
    }
}

function gotoInternal(id) {
    if (isNaN(id)) {
        const index = getMap().indexOf(id);
        if (index >= 0) {
            appData.imageSet.current = index;
            imageCallbacks.updateImage();
        }
    } else {
        let num = parseInt(id);
        if (num > 0 && num <= getMap().length) {
            num = num - 1;
        }
        appData.imageSet.current = num;
        imageCallbacks.updateImage();
    }
}

async function goto() {
    let result = await BootBox.prompt("Please enter a hash or number");
    if (result != null) {
        gotoInternal(result);
    }
}

function buildSearch() {
    const all = document.getElementById("searchAll");
    all.innerHTML = "All";
    const any = document.getElementById("searchAny");
    any.innerHTML = "Any";
    const none = document.getElementById("searchNone");
    none.innerHTML = "None";
    all.appendChild(makeCheckbox(`allTag-selectAll`, `allTag-selectAll`, `Select All`, function(name, state) {
        for (let i = 0; i < appData.tags.length; i++) {
            const boxes = document.getElementsByClassName(`allTag-${appData.tags[i]}`);
            for (let j = 0; j < boxes.length; j++) {
                console.log(boxes[j]);
                boxes[j].checked = state;
            }
        }
    }));
    any.appendChild(makeCheckbox(`anyTag-selectAll`, `anyTag-selectAll`, `Select All`, function(name, state) {
        for (let i = 0; i < appData.tags.length; i++) {
            const boxes = document.getElementsByClassName(`anyTag-${appData.tags[i]}`);
            for (let j = 0; j < boxes.length; j++) {
                boxes[j].checked = state;
            }
        }
    }));
    none.appendChild(makeCheckbox(`noneTag-selectAll`, `noneTag-selectAll`, `Select All`, function(name, state) {
        for (let i = 0; i < appData.tags.length; i++) {
            const boxes = document.getElementsByClassName(`noneTag-${appData.tags[i]}`);
            for (let j = 0; j < boxes.length; j++) {
                boxes[j].checked = state;
            }
        }
    }));
    for (let i = 0; i < appData.tags.length; i++) {
        const tag = appData.tags[i];
        all.appendChild(makeCheckbox(`allTag-${tag}`, `allTag-${tag}`, `${tag}`));
        any.appendChild(makeCheckbox(`anyTag-${tag}`, `anyTag-${tag}`, `${tag}`));
        none.appendChild(makeCheckbox(`noneTag-${tag}`, `noneTag-${tag}`, `${tag}`));
    }
}

async function getSubset(constraints) {
    appData.imageSet.constraints = constraints;
    appData.imageSet.seed = null;
    return await request(`/api/images/subset/${encodeURIComponent(JSON.stringify(constraints))}`);
}

async function search() {
    const constraints = {
        all: [],
        any: [],
        none: [],
        type: []
    };
    for (let i = 0; i < appData.tags.length; i++) {
        const tag = appData.tags[i];
        const all = document.getElementsByClassName(`allTag-${tag}`)[0];
        if (all.checked) {
            constraints.all.push(tag);
        }
        const any = document.getElementsByClassName(`anyTag-${tag}`)[0];
        if (any.checked) {
            constraints.any.push(tag);
        }
        const none = document.getElementsByClassName(`noneTag-${tag}`)[0];
        if (none.checked) {
            constraints.none.push(tag);
        }
    }
    if (document.getElementById("typeFilterVideo").checked) {
        constraints.type.push("video");
    }
    if (document.getElementById("typeFilterGif").checked) {
        constraints.type.push("gif");
    }
    if (document.getElementById("typeFilterStill").checked) {
        constraints.type.push("still");
    }
    const resolution = document.getElementById("resolutionSearch");
    switch (resolution.options[resolution.selectedIndex].text) {
        case "480p":
            constraints.width = 640;
            constraints.height = 480;
            break;
        case "720p":
            constraints.width = 1280;
            constraints.height = 720;
            break;
        case "1080p":
            constraints.width = 1920;
            constraints.height = 1080;
            break;
        default: break;
    }

    function setMap(elementName, varName) {
        const element = document.getElementById(elementName);
        if (element.value) {
            constraints[varName] = element.value;
        }
    }
    setMap("artistLex", "artist");
    setMap("albumLex", "album");
    setMap("titleLex", "title");
    setMap("tagsLex", "tagLexer");
    setMap("pathLex", "path");
    setMap("generalLex", "generalLexer");
    setMap("keywordSearch", "keywordSearch");

    $('#searchModal').modal('hide');
    try {
        const subset = await getSubset(constraints);
        appData.imageSet.current = 0;
        if (appData.currentImage) {
            const index = subset.indexOf(appData.currentImage.hash);
            if (index >= 0) {
                appData.imageSet.current = index;
            }
        }
        if (subset.length > 0) {
            appData.imageSet.map = subset;
            appData.imageSet.shuffleMap = null;
            appData.imageSet.seed = null;
            imageCallbacks.updateImage();
        } else {
            showMessage('No search results found');
        }
    } catch (err) {
        console.log(err);
        showMessage('Error making search request');
    }
}

function updateState() {
    console.log(appData.imageSet);
    if (getMap() && appData.imageSet.constraints) {
        const state = {
            constraints: appData.imageSet.constraints,
            hash: getMap()[appData.imageSet.current]
        };
        if (state.hash) {
            if (appData.imageSet.seed !== null && appData.imageSet.seed !== undefined) {
                state.seed = appData.imageSet.seed;
            }
            window.location.hash = `#${encodeURIComponent(JSON.stringify(state))}`;
        }
    } else {
        console.log('Map or constraints undefined', getMap().length, appData.imageSet.constraints);
    }
}

function resetSearch() {
    for (let i = 0; i < appData.tags.length; i++) {
        const tag = appData.tags[i];
        document.getElementsByClassName(`allTag-${tag}`)[0].checked = false;
        document.getElementsByClassName(`anyTag-${tag}`)[0].checked = false;
        document.getElementsByClassName(`noneTag-${tag}`)[0].checked = false;
    }
    document.getElementById("typeFilterVideo").checked = false;
    document.getElementById("typeFilterGif").checked = false;
    document.getElementById("typeFilterStill").checked = false;
    document.getElementById("resolutionSearch").selectedIndex = 0;
    document.getElementById("artistLex").value = "";
    document.getElementById("albumLex").value = "";
    document.getElementById("titleLex").value = "";
    document.getElementById("tagsLex").value = "";
    document.getElementById("pathLex").value = "";
    document.getElementById("generalLex").value = "";
    document.getElementById("keywordSearch").value = "";
}

async function deleteCurrent() {
    const del = await BootBox.confirm(`Delete ${appData.currentImage.path}?`);
    if (del === true) {
      try {
        await request(`/api/images/${appData.currentImage.hash}/delete`);
        getMap().splice(getMap().indexOf(appData.currentImage.hash), 1);
        if (appData.imageSet.current >= getMap().length) {
            appData.imageSet.current = 0;
        }
        await imageCallbacks.updateImage();
      } catch (err) {
        console.log(err);
        showMessage("Error deleting image");
      }
    }
}

async function tagCallback(tag, state) {
    try {
        if (state) {
            appData.currentImage.tags.push(tag);
            await request(`/api/images/${appData.currentImage.hash}/addTag/${tag}`);
        } else {
            const index = appData.currentImage.tags.indexOf(tag);
            if (index >= 0) {
                appData.currentImage.tags.splice(index, 1);
            }
            await request(`/api/images/${appData.currentImage.hash}/removeTag/${tag}`);
        }
        const tagBoxes = document.getElementsByClassName(`tag-${tag}`);
        for (let i = 0; i < tagBoxes.length; i++) {
            tagBoxes[i].checked = state;
        }
        appData.currentImage.tags.sort();
    } catch (err) {
        showMessage('Error saving tag state');
        console.log(err);
    }
}

async function addNewTag() {
    let result = await BootBox.prompt("Please enter the new tags name");
    if (result == null) {
        return;
    }
    if (!result) {
        showMessage('New tag invalid');
        return;
    }
    try {
        appData.tags = await request(`/api/tags/add/${result}`);
        setTags(appData.tags, tagCallback);
        await imageCallbacks.updateImage();
        buildSearch();
        toggleTags(true);
    } catch (err) {
        showMessage(`Error adding new tag ${result}`);
        console.log(err);
    }
}

async function runScan() {
    try {
        await request('/api/scanner/scan');
    } catch (err) {
        showMessage('Error starting scan');
        console.log(err);
    }
}

async function importNew() {
    const deleteClonesElement = document.getElementById("importDeleteClones");
    try {
        await request(`/api/scanner/index${deleteClonesElement.checked ? '?deleteClones=true' : ''}`);
    } catch (err) {
        showMessage('Error starting import');
        console.log(err);
    }
}

async function fullImport() {
    const deleteClonesElement = document.getElementById("fullImportDeleteClones");
    try {
        await request(`/api/scanner/import${deleteClonesElement.checked ? '?deleteClones=true' : ''}`);
    } catch (err) {
        showMessage('Error starting import');
        console.log(err);
    }
}

async function deleteMissing() {
    try {
        await request('/api/scan/deleteMissing');
        runScan();
    } catch (err) {
        showMessage('Error calling deleteMissing');
        console.log(err);
    }
}

async function runCache() {
    try {
        await request('/api/scanner/cache');
    } catch (err) {
        showMessage('Error starting caching');
        console.log(err);
    }
}

async function applyMetadata(type, multi) {
    const metadata = {};
    let value = "";
    switch (type) {
        case 'artist':
            metadata.artist = document.getElementById("artistMetadata").value;
            value = metadata.artist;
            break;
        case 'album':
            metadata.album = document.getElementById("albumMetadata").value;
            value = metadata.album;
            break;
        case 'title':
            metadata.title = document.getElementById("titleMetadata").value;
            value = metadata.title;
            break;
        default:
            return showMessage(`Error: Unknown metadata type ${type}`);

    }
    try {
        if (multi) {
            const result = await BootBox.confirm(`Are you sure you want to apply '${value}' to ${type} on all ${getMap().length} images?`);
            if (result) {
                showMessage(`Applying '${value}' to ${type} for ${getMap().length} images`);
                $('#metadataModal').modal('hide');
                // Copy so if the map changes it doesn't try apply to the new set.
                const map = getMap().slice(0);
                for (let i = 0; i < map.length; i++) {
                    await request(`/api/images/${map[i]}/metadata/${encodeURIComponent(JSON.stringify(metadata))}`);
                }
                showMessage(`Metdata applied to ${map.length} images`);
            }
        } else {
            await request(`/api/images/${getMap()[appData.imageSet.current]}/metadata/${encodeURIComponent(JSON.stringify(metadata))}`);
            $('#metadataModal').modal('hide');
            showMessage("Metadata saved");
            imageCallbacks.updateImage();
        }
    } catch (err) {
        showMessage('Error saving metadata');
        console.log(err);
    }
}

async function rebuildSearchIndex() {
    $('#adminModal').modal('hide');
    showMessage('Rebuilding search index...');
    try {
        await request('/api/search/rebuildIndex');
        showMessage('Search index rebuilt');
    } catch (err) {
        showMessage('Error startign search index rebuild');
        console.log(err);
    }
}

socket.on('message', function (data) {
    console.log(data);
    showMessage(data);
});

function updateAdminStatus() {
    const statusArea = document.getElementById("adminStatusArea");
    statusArea.value = formatAdminStatus(appData.scanStatus);
}

socket.on('scanStatus', function (data) {
    appData.scanStatus = data;
    updateAdminStatus();
});

(async function() {
    $('#loadingModal').modal('show');
    try {
        appData.tags = await request('/api/tags');
    } catch (err) {
        if (err.type && err.type === 'config') {
            console.log(`Invalid config (${err.message}), redirecting to setup...`);
            window.location.replace('/web/config.html');
            return;
        } else {
            console.log(err);
            showMessage(err.message);
        }
    }
    setTags(appData.tags, tagCallback);
    buildSearch();

    try {
        if (window.location.hash) {
            const str = window.location.hash.substring(1);
            const state = JSON.parse(decodeURIComponent(str));
            appData.imageSet.constraints = state.constraints;
            appData.imageSet.map = await getSubset(appData.imageSet.constraints);
            if (state.seed !== undefined && state.seed !== null) {
                appData.imageSet.seed = state.seed;
                appData.imageSet.shuffleMap = shuffleArray(appData.imageSet.map.slice(0), appData.imageSet.seed);
            }
            appData.imageSet.hash = state.hash;
            const index = getMap().indexOf(appData.imageSet.hash);
            if (index >= 0) {
                appData.imageSet.current = index;
            }
        } else {
            throw new Error('Hash not defined');
        }
    } catch (err) {
        try {
            const constraints = { type: 'still' };
            appData.imageSet.map = await getSubset(constraints);
            shuffle();
        } catch (err) {
            showMessage('Error fetching media');
            console.log(err);
        }
    }
    if (appData.imageSet.map && appData.imageSet.map.length > 0) {
        imageCallbacks.updateImage();
    } else {
        hideLoadingModal();
        showMessage('No media added. Click Import to begin');
        showModal('#adminModal');
    }
})();

function onResize() {
    const navBar = document.getElementById("navBar");
    const content = document.getElementById("mainContainer");
    content.style['padding-top'] = `${navBar.offsetHeight}px`;
    if (isTagsVisible() && document.getElementById("listColumn0").style.display != 'none' &&
            window.innerWidth < MIN_WIDTH_TAG_PANEL) {
        toggleTags();
    }
}
onResize();
