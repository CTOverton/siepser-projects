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
        TOKEN: 'REDACTED'
    },
    drive: {
        ROOT_FOLDER_ID: "REDACTED",
        TEMPLATE_FILE_ID: "REDACTED"
    }
}


function setUp() {
    let ss = SpreadsheetApp.getActive();
    ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit()
        .create();
}

function onFormSubmit(e) {
    const issue = formatIssue(e)

    Logger.log(`Issue ${issue}`)

    addToDrive(issue)
        .then(folder => {
            postIssue(issue, folder)
        })
        .catch(err => {
            // TODO
        })
}

function formatIssue(e) {
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
            const videosFolder = DriveApp.getFolderById(config.drive.ROOT_FOLDER_ID)
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
                    let response = UrlFetchApp.fetch(fileURL);
                    let file = response.getBlob()
                    let result = videoFolder.createFile(file);
                    Logger.log(`Created file ${result}`)
                } catch (err) {
                    Logger.log(`Error creating file ${err}`)
                }
            })

            const template = DriveApp.getFileById(config.drive.TEMPLATE_FILE_ID)
            const projectFile = template.makeCopy(issue.timeStamp + ' ' + issue.title, projectFilesFolder)

            Logger.log(`Created project file ${projectFile.getId()}`)

            resolve(issueFolder)
        } catch (err) {
            Logger.log(`Error during drive setup ${err}`)
            reject(err)
        }
    })
}

function postIssue(issue, driveFolder) {
    issue.url = `https://drive.google.com/drive/folders/${driveFolder.getId()}?usp=sharing`

    const data = {
        title:  issue.timeStamp + ' ' + issue.title,
        body:   `### Links\n` +
                `<img src="${config.assets.YOUTUBE_ICON}" width="48px" height="48px" alt="Chrome logo"> | ` +
                `<img src="${config.assets.EYETUBE_ICON}" width="48px" height="48px" alt="Eyetube logo"> |` +
                `<img src="${config.assets.DRIVE_ICON}" width="48px" height="48px" alt="Drive Logo"> |` +
                `<img src="${config.assets.PREMIERE_ICON}" width="48px" height="48px" alt="Premiere Logo">\n` +
                `------------ | ------------- | ------------- | -------------\n` +
                `YouTube | Eyetube | Google Drive | [Project Files](${issue.url})\n` +
                `\n` +
                `${issue.destination}\n` +

                `\n` +

                `### Video Info\n` +
                `Metadata | Value\n` +
                `------------ | -------------\n` +
                `Title | ${issue.title}\n` +
                `Subtitle | ${issue.subtitle}\n` +
                `Description | ${issue.description}\n` +
                `Tags | ${issue.tags}\n` +
                `Patient Name | ${issue.patient}\n` +

                `\n` +

                `### Download Links\n`
        ,
    };

    issue.links.forEach(link => {
        data.body += "- " + link + "\n"
    })

    const options = {
        "method": "POST",
        "contentType": "application/json",
        "headers": {
            "Authorization": "Basic " + config.github.TOKEN,
            "Content-Type": "application/json"
        },
        "payload" : JSON.stringify(data)
    };

    const response = UrlFetchApp.fetch(`${config.github.BASE_URL}/repos/${config.github.OWNER}/${config.github.REPO}/issues`, options);
    Logger.log(response.getContentText());
}

function currentDate() {
    const today = new Date()

    let dd = today.getDate()
    let mm = today.getMonth() + 1
    let yyyy = today.getFullYear()

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
        .then(folder => {
            postIssue(issue, folder)
        })
}
