const masterConfigs = require('./config_helper');
const axios = require('axios');

async function getSession(ifApiKey, configs) {
    const session = await axios.get(`${configs["IF_API_URL"]}/sessions?apikey=${ifApiKey}`);
    let expertServerObj = {};
    if (session.data.errorCode !== 0) return expertServerObj;
    session.data.result.forEach(element => {
        if (element.name === 'Expert Server') expertServerObj = element;
    });
    return expertServerObj;
}

exports.getFlights = async function (ifApiKey, guildConfigs) {
    let configs = await masterConfigs.loadMasterConfigs();
    let sessionId = await getSession(ifApiKey, configs);
    let callsignPattern = guildConfigs['callsign_patterns']['if_callsign'];
    console.log('.*' + callsignPattern + '.*');
    callsignPattern = ('.*' + callsignPattern + '.*').replace(/x/g, '\\d');
    console.log(callsignPattern);
    var rxPattern = new RegExp(callsignPattern);
    let vaFlights = await getAllFlights(sessionId['id'], configs['IF_API_URL'], ifApiKey, rxPattern);
    vaFlights = await getAllFlightPlans(configs['IF_API_URL'], ifApiKey, sessionId['id'], vaFlights);
    return vaFlights;
}

async function getAllFlights(sessionId, ifApiUrl, ifApiKey, callsignPattern) {
    let filteredFlights = [];
    let allFlights = await axios.get(`${ifApiUrl}/flights/${sessionId}?apikey=${ifApiKey}`);
    allFlights.data['result'].forEach(element => {
        if (callsignPattern.test(element['callsign'])) filteredFlights.push(element);
    })
    return filteredFlights;
}

async function getAllFlightPlans(ifApiUrl, ifApiKey, sessionId, vaFLights) {
    let aircraft_datastore = await masterConfigs.readAircraftDatastore();
    let responseObj = []
    let flightPlans = await axios.get(`${ifApiUrl}/flightplans/${sessionId}?apikey=${ifApiKey}`)
    for (let i = 0; i < vaFLights.length; i++) {
        let route = 'No FPL Found';
        let livery = '';
        let aircraft = '';
        let username = (vaFLights[i]['username'] === null) ? "IFC Not linked" : vaFLights[i]['username'];

        for (let j = 0; j < flightPlans.data.result.length; j++) {
            if (vaFLights[i]['flightId'] === flightPlans.data.result[j]['flightId']) {
                if (flightPlans.data.result[j].waypoints.length === 0) break;
                route = flightPlans.data.result[j].waypoints[0] + '-' + flightPlans.data.result[j].waypoints[flightPlans.data.result[j].waypoints.length - 1]
            }
        }
        for (let j = 0; j < aircraft_datastore.length; j++) {
            if (aircraft_datastore[j]['AircraftId'] === vaFLights[i]['aircraftId'] && aircraft_datastore[j]['LiveryId'] === vaFLights[i]['liveryId']) {
                aircraft = aircraft_datastore[j]['AircraftName'];
                livery = aircraft_datastore[j]['LiveryName'];
            }
        }
        responseObj.push({
            username: username,
            callsign: vaFLights[i]['callsign'],
            altitude: ((Math.round(vaFLights[i]['altitude'] / 100)) * 100).toString() + 'ft',
            gs: (Math.round(vaFLights[i]['speed'])).toString() + 'kts',
            aircraft: aircraft,
            livery: livery,
            route: route
        })

    }
    return responseObj;
}
exports.getATC = async function (ifApiKey, masterConfigs) {
    let sessionId = await getSession(ifApiKey, masterConfigs);
    console.log(`${masterConfigs['IF_API_URL']}/atc/${sessionId['id']}?apikey=${ifApiKey}`);
    let allAtc = await axios.get(`${masterConfigs['IF_API_URL']}/atc/${sessionId['id']}?apikey=${ifApiKey}`);
    let groupedData = await groupATCjson(allAtc.data['result']);
    return groupedData;
}

async function groupATCjson(jsonObj) {
    let airports = {}
    for (let i = 0; i < jsonObj.length; i++) {
        let airportName = jsonObj[i]['airportName'];
        if (airportName === null) airportName = 'Unknown';
        //console.log(airportName, airportName in airports);
        if (airportName in airports) {
            if (!airports[airportName]['controllers'].includes(jsonObj[i]['username'])) airports[airportName]['controllers'] += (', ' + jsonObj[i]['username']);
            airports[airportName]['frequency'] += (await getFrequencyType(jsonObj[i]['type']));
        } else {

            airports[airportName] = { 'controllers': (jsonObj[i]['username'] === undefined || jsonObj[i]['username'] === null) ? 'xxx' : jsonObj[i]['username'] };
            airports[airportName]['frequency'] = (await getFrequencyType(jsonObj[i]['type']));
        }
    }
    return airports;
}

async function getFrequencyType(freqInt) {
    const freq = {
        '0': 'G',
        '1': 'T',
        '4': 'A',
        '5': 'D',
        '6': 'C',
        '7': 'S'
    }
    if (freqInt.toString() in freq) {
        return freq[freqInt.toString()];
    } else {
        return 'U';
    }
}

exports.getUserStats = async function (ifApiKey, username) {
    let configs = await masterConfigs.loadMasterConfigs();
    const user = await axios.post(`${configs["IF_API_URL"]}/user/stats?apikey=${ifApiKey}`, {
        discourseNames: [username]
    });
    let response = {};
    let result = user.data['result'];
    if (result.length > 0) response = result[0];
    return response;
}

exports.getATIS = async function (airportIcao, ifApiKey) {
    let configs = await masterConfigs.loadMasterConfigs();
    let sessionId = await getSession(ifApiKey, configs);
    let atisResponse = "";
    try {
        let atis = await axios.get(`${configs['IF_API_URL']}/airport/${airportIcao}/atis/${sessionId['id']}?apikey=${ifApiKey}`)
        atisResponse = atis.data['result'];
        return atisResponse;
    } catch {
        return atisResponse;
    }
}

exports.getMetar = async function getMetar(icao) {
    let avwx = `Token WBeBM4-Mq8g-AuXrdFWfdA9ZXEuUrvBFe_Gdi8Yj1E8`
    let url = `https://avwx.rest/api/metar/${icao}?options=&reporting=true&format=json&onfail=cache`
    let config = {
        headers: {
            Authorization: avwx
        }
    }
    console.log(icao)
    console.log(url)
    let data = await axios.get(url, config = config)
    console.log(Object.keys(data.data));
    let responseMessage = `
METAR: ${data.data.sanitized}
Altimeter: ${data.data.altimeter.value}
Clouds: ${data.data.clouds.length ? data.data.clouds[0].value : '-'}
Flight Rules ${data.data.flight_rules}
Visibility: ${data.data.visibility.value}
Winds: ${data.data.wind_speed.value + "kts. @ " + data.data.wind_direction.value + "." }
Remarks: ${data.data.remarks}
Temperature: ${data.data.temperature.value}
Dewpoint: ${data.data.dewpoint.value}
Time: ${data.data.time.dt}
    `
    return responseMessage
}