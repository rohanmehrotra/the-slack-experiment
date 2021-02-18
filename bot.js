const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const liveService = require('./if_live_api_helper');
const app = express();
const port = process.env.PORT|| 3000;
const axios = require('axios');
const request = require('request')
// Where we will keep books
let books = [];

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/auth', (req, res) =>{
	res.sendFile(__dirname + '/add_to_slack.html')
})

app.get('/auth/redirect', (req, res) =>{
	var options = {
  		uri: 'https://slack.com/api/oauth.access?code='
  			+req.query.code+
  			'&client_id='+process.env.CLIENT_ID+
  			'&client_secret='+process.env.CLIENT_SECRET+
  			'&redirect_uri='+process.env.REDIRECT_URI,
		method: 'GET'
  	}
  	request(options, (error, response, body) => {
  		var JSONresponse = JSON.parse(body)
  		if (!JSONresponse.ok){
  			console.log(JSONresponse)
  			res.send("Error encountered: \n"+JSON.stringify(JSONresponse)).status(200).end()
  		}else{
  			console.log(JSONresponse)
  			res.send("Success!")
  		}
  	})
})

app.post('/live', async (req, res) => {
    // We will be coding here
    console.log(req.protocol + '://' + req.get('Host') + req.url);
    let responseUrl = req.body.response_url;
    res.send({
        "response_type": "in_channel",
        "text": "Wait for it!!!!!!!"
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
    let responseObj = {}
    let response_message = "Here are your live flights:\n"
    for(flight of liveFlights){
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
    responseObj['response_type'] = "in_channel";
    responseObj['text'] = response_message;

    axios.post(responseUrl, responseObj)
});

app.listen(port, () => console.log(`Hello world app listening on port ${port}!`));