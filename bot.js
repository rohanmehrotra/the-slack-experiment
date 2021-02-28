const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const liveService = require('./if_live_api_helper');
const app = express();
const port = process.env.PORT || 3000;
const axios = require('axios');
const request = require('request');
const masterConfigs = require('./config_helper');
require('dotenv').config({ path: './.env' })
// Where we will keep books
let books = [];

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/auth', (req, res) => {
    res.sendFile(__dirname + '/add_to_slack.html')
})

app.get('/auth/redirect', (req, res) => {
    console.log(req.query);
    var options = {
        uri: 'https://slack.com/api/oauth.v2.access?code='
            + req.query.code +
            '&client_id=' + process.env.CLIENT_ID +
            '&client_secret=' + process.env.CLIENT_SECRET +
            '&redirect_uri=' + process.env.REDIRECT_URI,
        method: 'GET'
    }
    request(options, (error, response, body) => {
        var JSONresponse = JSON.parse(body)
        if (!JSONresponse.ok) {
            console.log(JSONresponse)
            res.send("Error encountered: \n" + JSON.stringify(JSONresponse)).status(200).end()
        } else {
            console.log(JSONresponse)
            res.send("Success!")
        }
    })
})

app.post('/live', async (req, res) => {
    let responseUrl = req.body.response_url;
    res.send({
        "text": "Trying to fetch your live flights."
    })
    console.log('Request received');
    let guildData = {
        "callsign_patterns": {
            "if_callsign": "Air India xxxVA",
            "discord_callsign": "AIVAxxx",
            "callsign_prefix_airtable": "AIVA"
        }
    };
    var liveFlights = await liveService.getFlights(process.env.IF_API_KEY, guildData);
    let response_message = "Here are your live flights:\n"
    for (flight of liveFlights) {
        response_message += `
IFC Username: ${flight['username']}
Callsign: ${flight['callsign']}
Altitude: ${flight['altitude']} 
Ground Speed: ${flight['gs']}
Aircraft: ${flight['aircraft']}
Livery: ${flight['livery']} 
Route: ${flight['route']}

        `
    }
    let responseObj = {
        text: response_message
    }

    axios.post(responseUrl, responseObj)
});

app.post('/ifatc', async (req, res) => {
    res.send({
        "text": "Fetching active ATC regions!"
    })
    console.log(req.protocol + '://' + req.get('Host') + req.url);

    let responseUrl = req.body.response_url;
    res.send({
        "text": "Fetching active ATC regions!"
    })
    let configs = await masterConfigs.loadMasterConfigs();
    let atc = await liveService.getATC(process.env.IF_API_KEY, configs);
    let responseObj = {}
    let response_message = "Here are the active ATC airports:\n";
    responseObj = {};
    let airports = Object.keys(atc);
    for (let i = 0; i < airports.length; i++) {
        response_message += `
${airports[i]} - ${atc[airports[i]]['controllers']} - ${atc[airports[i]]['frequency']}`

    }
    responseObj['text'] = response_message;

    axios.post(responseUrl, responseObj)

});

app.post('/stats', async (req, res) => {
    res.send({
        text: "Trying to fetch the stats of the user from Infinite Flight."
    })

    let responseUrl = req.body.response_url;
    let liveApiUserRequestUrl = "";
    let username = req.body.text;
    let userStats = await liveService.getUserStats(process.env.IF_API_KEY, username)
    if (userStats === {}) {
        axios.post(responseUrl, {
            text: "Sorry I counldn't find the stats for the UserID: " + username
        })
    } else {
        let ft = (userStats.flightTime / 3600).toString() + ":" + (userStats.flightTime / 60)
        var hours = Math.floor(userStats['flightTime'] / 60);
        var minutes = userStats['flightTime'] % 60;
        let responseMessage = `
Username: ${userStats.discourseUsername}
VA/VO Affiliation: ${userStats.virtualOrganization}
XP: ${userStats.xp}
Flight Time: ${hours.toString()}:${minutes.toString()}
Level 1 Vios: ${userStats['violationCountByLevel']['level1']}
Level 2 Vios: ${userStats['violationCountByLevel']['level2']}
Level 3 Vios: ${userStats['violationCountByLevel']['level2']}
Total Flights: ${userStats['onlineFlights']}
Landings: ${userStats['landingCount']}
ATC Ops: ${userStats['atcOperations']}
    `
        responseObj = {
            text: responseMessage
        }
        console.log(responseMessage);
        axios.post(responseUrl, responseObj);
    }
});

app.post('/atis', async (req, res) => {
    let responseUrl = req.body.response_url;
    let icao = req.body.text;
    res.send({
        text: "Trying to fetch the D-ATIS of the desired airport. You will only get results if the ATIS frequency is active in the region!"
    });
    let atisInfo = await liveService.getATIS(
        icao, process.env.IF_API_KEY
    );
    if(atisInfo === ""){
        axios.post(responseUrl, {
            text: "Sorry! I was unable to fetch the desired airport's ATIS information! The airport might not be active currently."
        })
    }else{
        axios.post(responseUrl, {
            text: atisInfo
        })
    }
    console.log(icao, atisInfo)

});
app.listen(port, () => console.log(`Hello world app listening on port ${port}!`));