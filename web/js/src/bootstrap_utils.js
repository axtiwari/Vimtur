const MAX_COLUMNS = 5;
// The minimum width that the tag panel can be used instead of the modal.
const MIN_WIDTH_TAG_PANEL = 1700;

class BootBox {
    static async alert(msg) {
        return new Promise(function(resolve) {
            bootbox.alert(msg, resolve);
        });
    }
    static async prompt(msg) {
        return new Promise(function(resolve) {
            bootbox.prompt(msg, resolve);
        });
    }
    static async confirm(msg) {
        return new Promise(function(resolve) {
            bootbox.confirm(msg, resolve);
        });
    }
}

function showModal(id) {
    $(id).addClass("in");
    $('body').addClass('modal-open');
    $(id).modal();
}

function hideModal(id) {
    $(id).removeClass("in");
    $(".modal-backdrop").remove();
    $('body').removeClass('modal-open');
    $('body').css('padding-right', '');
    $(id).hide();
}

function getNumColumns(type) {
    for (let i = 0; i < MAX_COLUMNS; i++) {
        if (!document.getElementById(`${type}${i}`)) {
            return i;
        }
    }
    return 0;
}

function makeCheckbox(id, className, name, callback) {
    const div = document.createElement("div");
    div.className = "form-check";
    const box = document.createElement("input");
    box.className = `form-check-input ${className}`;
    box.id = id;
    box.type = "checkbox";
    const label = document.createElement("label");
    label.className = "form-check-label";
    label.setAttribute("for", id);
    label.innerHTML = name;
    div.appendChild(box);
    div.appendChild(label);

    if (callback) {
        box.addEventListener("click", function() {
            callback(name, box.checked);
        });
    }

    return div;
}

function makeAlert(message) {
    const alertDiv = document.createElement("div");
    alertDiv.setAttribute("class", "default-alert alert alert-primary alert-dismissible");
    alertDiv.setAttribute("role", "alert");
    alertDiv.innerHTML += message;
    alertDiv.onclick = function() {
        document.body.removeChild(alertDiv);
    };
    const exitButton = document.createElement("button");
    exitButton.setAttribute("type", "button");
    exitButton.setAttribute("class", "close");
    exitButton.setAttribute("data-dismiss", "alert");
    exitButton.setAttribute("aria-label", "Close");
    const x = document.createElement("span");
    x.setAttribute("aria-hidden", "true");
    x.innerHTML += "&times;"
    exitButton.appendChild(x);
    alertDiv.appendChild(exitButton);
    alertDiv.setAttribute("id", "alertDiv");
    return alertDiv;
}

function showMessage(message) {
    if (document.getElementById("alertDiv")) {
        const alo = document.getElementById("alertDiv");
        clearTimeout(alo.timeout);
        document.body.removeChild(alo);
    }
    const al = makeAlert(message);
    document.body.insertBefore(al, document.body.firstChild);
    al.timeout = setTimeout(function() {
        al.timeout = null;
        document.body.removeChild(al);
    }, 3000);
}

function addCheckbox(id, name, callback, index, total) {
    const numColumns = getNumColumns("listColumn");
    const col = document.getElementById(`listColumn${Math.floor((index / total) * numColumns)}`);
    const checkbox = makeCheckbox(`${id}0`, id, name, callback);
    col.appendChild(checkbox);

    const numColumns2 = getNumColumns("tagModalList");
    const tagModalList = document.getElementById(`tagModalList${Math.floor((index / total) * numColumns2)}`);
    const modalCheckbox = makeCheckbox(`${id}1`, id, name, callback);
    tagModalList.appendChild(modalCheckbox);
}

function toggleTags(state) {
    if (state !== undefined) {
        if (state == isTagsVisible()) {
            return;
        }
    }
    const container = document.getElementById("content");
    const numColumns = getNumColumns('listColumn');
    if (isTagsVisible()) {
        for (let i = 0; i < numColumns; i++) {
            document.getElementById(`listColumn${i}`).style.display = 'none';
        }
        hideModal("#tagModal");
    } else {
        if (window.innerWidth > MIN_WIDTH_TAG_PANEL && !isMobile()) {
            for (let i = 0; i < numColumns; i++) {
                document.getElementById(`listColumn${i}`).style.display = 'block';
            }
        } else {
            showModal("#tagModal");
        }
    }
}

function isTagsVisible() {
    return document.getElementById("listColumn0").style.display != 'none' || document.getElementById("tagModal").style.display != 'none';
}

function setTags(tagList, callback) {
    const visible = isTagsVisible();
    console.log(`Visible: ${visible}`);
    const numColumns = getNumColumns("listColumn");
    for (let i = 0; i < numColumns; i++) {
        document.getElementById(`listColumn${i}`).innerHTML = "";
    }
    const numColumns2 = getNumColumns("tagModalList");
    for (let j = 0; j < numColumns2.length; j++) {
        document.getElementById(`tagModalList${j}`).innerHTML = "";
    }
    for (let i = 0; i < tagList.length; i++) {
        addCheckbox(`tag-${tagList[i]}`, `${tagList[i]}`, callback, i, tagList.length);
    }
}

function setChecked(checkedList) {
    for (let i = 0; i < appData.tags.length; i++) {
        const tagBoxes = document.getElementsByClassName(`tag-${appData.tags[i]}`);
        for (let j = 0; j < tagBoxes.length; j++) {
            tagBoxes[j].checked = checkedList.includes(appData.tags[i]);
        }
    }
}

function isMobile() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

function formatScannerStatus(data) {
    let scanStatus = "";
    if (data.time != undefined) {
        const date = new Date();
        date.setTime(data.time);
        scanStatus += "Last run completed at: " + date.toUTCString() + "\n";
        scanStatus += data.numVerified + " files verified.\n";
        scanStatus += data.numNew + " new files found.\n";
        scanStatus += data.missing.length + " files detected as missing.\n";
        for (let i = 0; i < data.missing.length; i++) {
            scanStatus += data.missing[i].absolutePath + "\n";
        }
    }
    return scanStatus;
}

function formatAdminStatus(appData) {
    let result = `Library Path: ${appData.libraryPath}\nState: ${appData.state}\n\n`;

    if (appData.scanStatus != undefined) {
        result += formatScannerStatus(appData.scanStatus) + "\n\n";
    }

    result += "Indexing Status: ";
    if (appData.state == "INDEXING" && appData.importStatus) {
        result += "Running.\n";
        if (appData.importStatus.current != undefined) {
            result += "Processing " + appData.importStatus.current + "/" + appData.importStatus.max + ".\n";
        }
    } else {
        result += "Not running.\n";
    }
    result += '\n';

    if (appData.cacheStatus) {
        result += `Videos cached: ${appData.cacheStatus.cached}/${appData.cacheStatus.max}\n`
        result += `Videos marked as corrupted: ${appData.cacheStatus.corrupted}\n`
        if (appData.cacheStatus.converter) {
            if (appData.cacheStatus.converter.state) {
                result += `Cache state: ${appData.cacheStatus.converter.state}\n`
            }
            if (appData.cacheStatus.converter.max) {
                result += `Progress: ${appData.cacheStatus.converter.progress} / ${appData.cacheStatus.converter.max}\n`
            }
            if (appData.cacheStatus.converter.corrupted) {
                result += 'Corrupted files:\n'
                for (let i = 0; i < appData.cacheStatus.converter.corrupted.length; i++) {
                    result += `${appData.cacheStatus.converter.corrupted[i]}\n`;
                }
            }
        }
    }
    result += '\n';
    return result;
}

class PRNG {
    constructor(seed) {
        this.seed = seed;
    }
    nextFloat() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        const rnd = this.seed / 233280;

        return rnd;
    }
}

function shuffleArray(array, seed) {
    if (!seed && seed !== 0) {
        seed = Math.random();
    }
    const prng = new PRNG(seed);
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(prng.nextFloat() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function fullscreen() {
    if (document.documentElement.requestFullScreen) {
        document.documentElement.requestFullScreen();
    } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullScreen) {
        document.documentElement.webkitRequestFullScreen();
    }
}

async function request(url) {
    return new Promise(function (resolve, reject) {
        const xhttp = new XMLHttpRequest();
        xhttp.onload = function() {
            let response = xhttp.responseText;
            try {
                response = JSON.parse(response);
            } catch (err) {
                // Ignore
            }
            if (xhttp.status == 200) {
                resolve(response);
            } else {
                reject(response);
            }
        }
        xhttp.onerror = function(target, type) {
            reject('Connection error.');
        }
        xhttp.open("GET", url, true);
        xhttp.send();
    });
}
