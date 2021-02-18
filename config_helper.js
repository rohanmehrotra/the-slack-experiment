const fs = require('fs');



exports.loadMasterConfigs = async function(){
    return JSON.parse(fs.readFileSync('./master_configs.json'));
}


exports.readAircraftDatastore = async function(data){
    let fileContents = JSON.parse(fs.readFileSync('./aircraft_datastore.json'));
    return fileContents;
}

