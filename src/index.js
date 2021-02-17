const config = {
    assets: {
        YOUTUBE_ICON: 'https://www.youtube.com/about/static/svgs/icons/brand-resources/YouTube_icon_full-color.svg',
        EYETUBE_ICON: 'https://pbs.twimg.com/profile_images/928002063967096834/uvwi-2Fe_400x400.jpg',
        DRIVE_ICON: 'https://ssl.gstatic.com/images/branding/product/2x/hh_drive_96dp.png',
        PREMIERE_ICON: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Adobe_Premiere_Pro_CC_icon.svg/1200px-Adobe_Premiere_Pro_CC_icon.svg.png',
    },
    github: {
        BASE_URL: "https://api.github.com",
        OWNER: 'CTOverton',
        REPO: 'siepser-projects',
        PROJECT_COLUMN_IDS: {
            NEW: 11336757,
            IN_PROGRESS: 11336758,
            PENDING: 11416902,
            REVIEW: 11437964,
            DONE: 11336759,
            BLOCKED: 11416910,
        },
        TOKEN: 'Y3RvdmVydG9uOjNiMjIyYWFiY2FkNmNkZjdjNDlmYTkzNjY0MTczODNlNzNmZThkM2Q='
    },
    drive: {
        OLD_VIDEOS_FOLDER_ID: "0B0mHe8zya4PiR05Pb3FvOVZ0VnM",
        TEMPLATE_FILE_ID: "1hNKb06R8JKe2MjwI4rarruRYFrTQsotW",
        VIDEOS_FOLDER_ID: "1aMqSIPuZAK_2h7C9iOCxJTgBIGs_4TBY",
    }
}


function setUp() {
    let ss = SpreadsheetApp.getActive()
    ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit()
        .create()
}

function onFormSubmit(e) {
    const issue = formatIssueFromEvent(e)
    const { range } = e

    let newFolder

    Logger.log(`Issue ${issue}`)

    addToDrive(issue)
        .then(folder => {
            newFolder = folder
            return postIssue({...issue, project_url: folder.getUrl()})
        })
        .then(res => {
            addIssueToProject(res.id, config.github.PROJECT_COLUMN_IDS.NEW)
            addIssueLinkToResponse(res.html_url, range)
            addProjectLinkToResponse(newFolder.getUrl(), range)
        })
        .catch(err => {
            Logger.log(err)
        })
}

function formatIssueFromEvent(e) {
    return {
        timeStamp: currentDate(),
        title: e.namedValues['Title'][0],
        subtitle: e.namedValues['Subtitle'][0],
        description: e.namedValues['Description'][0],
        tags: e.namedValues['Video search tags'][0],
        patient: e.namedValues['Patient name'][0],
        destination: e.namedValues['Video destination'][0],
        links: e.namedValues['Dropbox video download links'][0].replace(/(\r\n|\n|\r)/gm,"").split(',').map(link => link.trim()),
    }
}

function addToDrive(issue) {
    return new Promise((resolve, reject) => {
        try {
            const videosFolder = DriveApp.getFolderById(config.drive.VIDEOS_FOLDER_ID)
            const issueFolder = videosFolder.createFolder(issue.timeStamp + ' ' + issue.title)

            const exportFolder = issueFolder.createFolder('export')
            const projectFilesFolder = issueFolder.createFolder('project files')
            const assetsFolder = projectFilesFolder.createFolder('assets')
            const audioFolder = assetsFolder.createFolder('audio')
            const graphicsFolder = assetsFolder.createFolder('graphics')
            const videoFolder = assetsFolder.createFolder('video')

            Logger.log(`Created folder ${issueFolder.getId()}`)

            issue.links.forEach(link => {
                let fileURL = link.replace('www.dropbox', 'dl.dropboxusercontent')
                try {
                    let response = UrlFetchApp.fetch(fileURL)
                    let file = response.getBlob()
                    let result = videoFolder.createFile(file)
                    Logger.log(`Created file ${result}`)
                } catch (err) {
                    Logger.log(`Error creating file ${err}`)
                }
            })

            const template = DriveApp.getFileById(config.drive.TEMPLATE_FILE_ID)
            const projectFile = template.makeCopy(issue.timeStamp + ' ' + issue.title + '.prproj', projectFilesFolder)

            Logger.log(`Created project file ${projectFile.getId()}`)

            resolve(issueFolder)
        } catch (err) {
            Logger.log(`Error during drive setup ${err}`)
            reject(err)
        }
    })
}

function postIssue(issue) {
    const data = {
        title:  issue.timeStamp + ' ' + issue.title,
        body:   `### Links\n` +
            `<img src="${config.assets.YOUTUBE_ICON}" width="48px" height="48px" alt="Chrome logo"> | ` +
            `<img src="${config.assets.EYETUBE_ICON}" width="48px" height="48px" alt="Eyetube logo"> |` +
            `<img src="${config.assets.DRIVE_ICON}" width="48px" height="48px" alt="Drive Logo"> |` +
            `<img src="${config.assets.PREMIERE_ICON}" width="48px" height="48px" alt="Premiere Logo">\n` +
            `------------ | ------------- | ------------- | -------------\n` +
            `${issue.youtube_url ? "[YouTube](" + issue.youtube_url + ")" : "YouTube"} | ` +
            `${issue.eyetube_url ? "[EyeTube](" + issue.eyetube_url + ")" : "EyeTube"} | ` +
            `${issue.video_url ? "[Google Drive](" + issue.video_url + ")" : "Google Drive"} | ` +
            `${issue.project_url ? "[Project Files](" + issue.project_url + ")" : "Project Files"} | \n` +
            `\n` +
            `> Destination: ${issue.destination}\n` +

            `\n` +

            `### Video Info\n` +
            `Metadata | Value\n` +
            `------------ | -------------\n` +
            `Title | ${issue.title}\n` +
            `Subtitle | ${issue.subtitle}\n` +
            `Description | ${issue.description}\n` +
            `Tags | ${issue.tags}\n` +
            `Patient | ${issue.patient}\n` +

            `\n` +

            `### Download Links\n`
        ,
        labels: issue.labels
    }

    issue.links.forEach(link => {
        data.body += "- " + link + "\n"
    })

    data.body += `## Notes\n` + issue.notes ? issue.notes : ''

    const options = {
        "method": "POST",
        "contentType": "application/json",
        "headers": {
            "Authorization": "Basic " + config.github.TOKEN,
            "Content-Type": "application/json"
        },
        "payload" : JSON.stringify(data)
    }

    const response = UrlFetchApp.fetch(`${config.github.BASE_URL}/repos/${config.github.OWNER}/${config.github.REPO}/issues`, options)
    const json = JSON.parse(response.getContentText())

    Logger.log(`Posted issue to github ${json.html_url}`)

    return json
}

function addIssueToProject(id, column_id) {
    const data = {
        "content_type": "Issue",
        "content_id": id
    }

    const options = {
        "method": "POST",
        "contentType": "application/json",
        "headers": {
            "Accept": "application/vnd.github.inertia-preview+json",
            "Authorization": "Basic " + config.github.TOKEN,
            "Content-Type": "application/json"
        },
        "payload" : JSON.stringify(data)
    }

    const response = UrlFetchApp.fetch(`${config.github.BASE_URL}/projects/columns/${column_id}/cards`, options)
    const json = JSON.parse(response.getContentText())

    Logger.log(`Added issue to project ${json.html_url}`)

    return json
}

function closeIssue(number) {
    const data = {
        "state": "closed"
    }

    const options = {
        "method": "PATCH",
        "contentType": "application/json",
        "headers": {
            "Authorization": "Basic " + config.github.TOKEN,
            "Content-Type": "application/json"
        },
        "payload" : JSON.stringify(data)
    }

    const response = UrlFetchApp.fetch(`${config.github.BASE_URL}/repos/${config.github.OWNER}/${config.github.REPO}/issues/${number}`, options)
    const json = JSON.parse(response.getContentText())

    Logger.log(`Closed issue ${json.html_url}`)

    return json
}

function addIssueLinkToResponse(url, range) {
    let cell = range.getCell(1, 1).offset(0,-2)
    cell.setValue(url)
    Logger.log(`Added issue link to response ${cell.getRow()} ${cell.getColumn()} ${url}`)
}

function addProjectLinkToResponse(url, range) {
    let cell = range.getCell(1, 1).offset(0,-1)
    cell.setValue(url)
    Logger.log(`Added project link to response ${cell.getRow()} ${cell.getColumn()} ${url}`)
}

function currentDate(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date()

    let dd = date.getDate()
    let mm = date.getMonth() + 1
    let yyyy = date.getFullYear()

    if (dd < 10)
        dd = '0' + dd

    if (mm < 10)
        mm = '0' + mm

    return yyyy + "_" + mm + "_" + dd
}

function test() {
    const testLinks = ''

    const issue = {
        timeStamp: currentDate(),
        title: 'Test issue title',
        subtitle: 'Test issue subtitle',
        description: 'Test issue description',
        tags: 'test, issue, tags',
        patient: 'Test Patient name',
        destination: 'YouTube, EyeTube',
        links: testLinks.replace(/(\r\n|\n|\r)/gm,"").split(',').map(link => link.trim()),
    }

    addToDrive(issue)
        .then(folder => postIssue({...issue, project_url: folder.getUrl()}))

}

function test2() {
    let sourceFolder = DriveApp.getFolderById("1d65QtXdTgZWUVJvRqRH31ttyBYmCnCtX")
    let targetFolder = DriveApp.getFolderById("198z2en1Nm11IchMTYCBy7uTWKRd7g1aJ")
    // let targetFolder = DriveApp.getFolderById(config.drive.VIDEOS_FOLDER_ID)

    copyFolder(sourceFolder, targetFolder)
}

function copyFolder(source, target) {
    let copy = target.createFolder(source.getName())

    copyFolderRecursive(source, copy)

    return copy
}

function copyFolderRecursive(source, target) {
    let folders = source.getFolders()
    let files = source.getFiles()

    while (files.hasNext()) {
        let file = files.next()
        Logger.log(`Copying ${file.getName()} to ${target.getName()}`)
        file.makeCopy(file.getName(), target)
    }

    while (folders.hasNext()) {
        let subFolder = folders.next()
        let folderName = subFolder.getName()
        if (folderName === 'Adobe Premiere Pro Video Previews' || folderName === 'Adobe Premiere Pro Audio Previews') {
            Logger.log(`Skipping ${folderName}`)
        } else {
            Logger.log(`Creating folder ${folderName}`)
            let targetFolder = target.createFolder(folderName)
            copyFolderRecursive(subFolder, targetFolder)
        }
    }
}

function clean() {
    let ss = SpreadsheetApp.getActive()
    let sheet = ss.getSheetByName('Copy of Old Videos')
    let videosSheet = ss.getSheetByName('Videos')
    let range = sheet.getDataRange()
    let data = range.getValues()

    data.forEach((cell, index) => {
        if (index < 31) return

        let video = {
            timestamp: cell[0],
            title: cell[1],
            subtitle: cell[2],
            patient: cell[3],
            description: cell[4],
            tags: cell[5],
            video_destination: cell[6],
            destination: cell[7],
            video_url: extractUrl(index + 1, 9, range),
            youtube_url: extractUrl(index + 1, 10, range),
            eyetube_url: extractUrl(index + 1, 11, range),
            status: cell[11],
            project_url: extractUrl(index + 1, 13, range),
            project_title: cell[12],
            notes: cell[13],
            dropbox_urls: cell[14],
        }

        Logger.log(video)

        let labels = []
        /*
        * ASAP
        * Canceled
        * Complete
        * Edited
        * EyeTube
        * Published
        * YouTube
        * */

        let projectColumn
        let close = false

        if (video.youtube_url) labels.push('YouTube')
        if (video.eyetube_url) labels.push('EyeTube')
        if (video.youtube_url || video.eyetube_url) labels.push('Published')

        switch (video.status) {
            case '1_ASAP':
                projectColumn = config.github.PROJECT_COLUMN_IDS.REVIEW
                labels.push('ASAP')
                break
            case '2_Pending VO':
                projectColumn = config.github.PROJECT_COLUMN_IDS.REVIEW
                labels.push('Edited')
                break
            case '3_In Progress':
                projectColumn = config.github.PROJECT_COLUMN_IDS.REVIEW
                break
            case '4_Raw':
                projectColumn = config.github.PROJECT_COLUMN_IDS.NEW
                break
            case '5_On Hold':
                projectColumn = config.github.PROJECT_COLUMN_IDS.BLOCKED
                break
            case '6_Completed':
                projectColumn = config.github.PROJECT_COLUMN_IDS.DONE
                labels.push('Complete')
                close = true
                break
            case '7_Scrapped':
                projectColumn = config.github.PROJECT_COLUMN_IDS.DONE
                labels.push('Canceled')
                close = true
                break
            default:
                projectColumn = config.github.PROJECT_COLUMN_IDS.REVIEW
        }

        let issue = formatIssueFromSheet(video, labels)
        Logger.log(issue)

        if (video.project_url) {
            // Move drive folders
            const oldFolder = DriveApp.getFolderById(getIdFromUrl(video.project_url))
            const videosFolder = DriveApp.getFolderById(config.drive.VIDEOS_FOLDER_ID)

            let newFolder = copyFolder(oldFolder, videosFolder)

            let res = postIssue({...issue, project_url: newFolder.getUrl()})
            if (projectColumn) addIssueToProject(res.id, projectColumn)
            if (close) closeIssue(res.number)

            // Tracking Link    Project Link   	Timestamp	Title	Subtitle	Patient name	Description	Video search tags	Video destination	Dropbox video download links	Notes
            videosSheet.appendRow([res.html_url, newFolder.getUrl(), issue.timeStamp, issue.title, issue.subtitle, issue.patient, issue.description, issue.tags, issue.destination, issue.links, issue.notes])
        } else {
            let newFolder
            // Create drive folders
            addToDrive(issue)
                .then(folder => {
                    newFolder = folder
                    return postIssue({...issue, project_url: folder.getUrl()})
                })
                .then(res => {
                    if (projectColumn) addIssueToProject(res.id, projectColumn)
                    if (close) closeIssue(res.number)

                    videosSheet.appendRow([res.html_url, newFolder.getUrl(), issue.timeStamp, issue.title, issue.subtitle, issue.patient, issue.description, issue.tags, issue.destination, issue.links, issue.notes])
                })
                .catch(err => Logger.log(err))
        }
    })
}

function extractUrl(row, column, range) {
    let data = range.getCell(row, column).getFormula().match(/=hyperlink\("([^"]+)"/i)

    return data ? data[1] : null
}

function formatIssueFromSheet(video, labels) {

    let timestamp = video.timestamp
    if (timestamp) {
        timestamp = currentDate(video.timestamp)
    } else if (video.project_title && parseInt(video.project_title.slice(0,1))) {
        timestamp = video.project_title.slice(0,10).replace('.','_')
    }

    return {
        timeStamp: timestamp,
        title: video.title,
        subtitle: video.subtitle,
        description: video.description ? video.description : video.subtitle,
        tags: video.tags,
        patient: video.patient,
        destination: video.destination + " " + video.video_destination,
        links: video.dropbox_urls.replace(/(\r\n|\n|\r)/gm,"").split(',').map(link => link.trim()),
        labels: labels,
        video_url: video.video_url,
        youtube_url: video.youtube_url,
        eyetube_url: video.eyetube_url,
        notes:  video.notes &&
            "```\n" +
            `${video.notes}\n` +
            "```\n"
    }
}

function getIdFromUrl(url) {
    return url.includes("folders") ? url.split("folders/")[1].split("?")[0] : url.split("id=")[1]
}
