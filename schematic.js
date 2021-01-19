var fs = require('fs');
var Schematic = require('schematic');

fs.readFile('./marker.schematic', function (err, data) {
    Schematic.parse(data, function (err, schem) {
        console.log(schem.getBlock(0, 0, 0));
    });
});