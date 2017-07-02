var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
var env = process.env.ENVIRONMENT;
var volumeId = process.env.VOLUME_ID;
var serviceName = process.env.SERVICE_NAME;
var retentionPeriod = process.env.RETENTION_PERIOD;

exports.handler = (event, context, callback) => {
    createSnapshot(function(err) {
        if (err) {
            callback(err);
        } else {
            removeOldSnapshots(function() {
                callback(null);
            });   
        }
    });
};

function removeOldSnapshots(callback) {
    getAllSnapshots(function(err, snapshots) {
        if (err) {
            return callback(err);
        }
        
        var oldSnapshotsCount = snapshots.length - retentionPeriod;

        if (oldSnapshotsCount > 0) {
            var oldSnapshots = snapshots.splice(0, oldSnapshotsCount);

            oldSnapshots.forEach(function(snapshot) {
                var id = snapshot.SnapshotId;
                
                if (!id) return;

                ec2.deleteSnapshot({SnapshotId: id}, function(err){});
            });
        }
        
        callback(null);
    });
}

function getAllSnapshots(callback) {
    var params = {
        Filters: [
            {
                Name: "volume-id", 
                Values: [volumeId]
            },
            {
                Name: "status", 
                Values: ["completed"]
            }
        ]
    };
    
    ec2.describeSnapshots(params, function(err, data) {
        var snapshots = data.Snapshots;
        
        if (!snapshots) {
            callback(err);
        }
        
        snapshots.sort(function(sn1, sn2) {
            var sn1StartTime = Date.parse(sn1.StartTime);
            var sn2StartTime = Date.parse(sn2.StartTime);
            
            return sn1StartTime - sn2StartTime;
        });
        
        callback(null, snapshots);
    });
}


function createSnapshot(callback) {
    var params = {
      Description: `${serviceName} volume snapshot`, 
      VolumeId: volumeId
     };

     ec2.createSnapshot(params, function(err, data) {
        if (err) {
            callback(err);       
        } else {
            var snapshotId = data.SnapshotId;
            
            if (!snapshotId) {
                callback(err);
            }
            
            var params = {
                Resources: [snapshotId], 
                Tags: [
                    {
                        Key: "Service", 
                        Value: serviceName
                    },
                    {
                        Key: "Environment",
                        Value: env
                    }
                ]
            };
            
            ec2.createTags(params, callback);
        }
     });
}