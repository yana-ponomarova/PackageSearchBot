require('dotenv-extended').load();



var builder = require('botbuilder');
var zipcodedialog = require('./zipcodedialog');

var restify = require('restify');

var Store = require('./store');

var spellService = require('./spell-service');



// Setup Restify Server

var server = restify.createServer();

/*server.listen(process.env.port || process.env.PORT || 3978, function () {

    console.log('%s listening to %s', server.name, server.url);

});*/


 // Serve a static web page
 server.get(/.*/, restify.serveStatic({
 	'directory': '.',
 	'default': 'index.html'
 }));
 
 server.listen(process.env.port || 3978, function () {
     console.log('%s listening to %s', server.name, server.url); 
 });


// Create connector and listen for messages

var connector = new builder.ChatConnector({

    appId: process.env.MICROSOFT_APP_ID,

    appPassword: process.env.MICROSOFT_APP_PASSWORD

});

server.post('/api/messages', connector.listen());



var bot = new builder.UniversalBot(connector);



bot.dialog('/', [
    function (session) {
        session.previousdialog = '/';
        profile_ensured = 0;
        if(session.userData.profile) {
            if (session.userData.profile.name && session.userData.profile.zipcode) {
                session.send('You can now proceed with the Parsel Tracking', session.userData.profile);
                session.previousdialog = '/'; 
                profile_ensured = 1;
                session.beginDialog('ParselTracking', session.userData.parsel);
                
            }
        }
         
        if(!profile_ensured) {
            session.beginDialog('/ensureProfile', session.userData.profile);
        }
            
        
        
    },

]);


bot.dialog('/ensureProfile', [
    function (session, args, next) {
        session.userData.profile = args || {};

        if (!session.userData.profile.name) {
            builder.Prompts.text(session, "What's your name?");

        } else {
            next();

        }
    },


    function (session, args, next) {

        // Check their answer

        if (session.userData.profile.name) {

            if (!session.userData.profile.zipcode) {
       //         session.send("What is your zipcode please?"); 
                builder.Prompts.text(session, "What is your zipcode please?");

 
            } else {
                    next();
            }
        } else {
            session.beginDialog('/ensureProfile', session.userData.profile);
        }      
    },

    function (session, results, next) {

        if (session.userData.profile.name) {
            if (!session.userData.profile.zipcode) {

                var text = results.response.toString();
                var regex = /\b[1-9]\d{3,4}\b/ ;
                var zipcode = regex.exec(text); 

                if (zipcode && zipcode[0].length > 3 && zipcode[0].length < 6) {
                    zipcode = zipcode[0];
                    session.userData.profile.zipcode = zipcode;
                    session.send('Thanks, your zip code is registered as %s', zipcode);
                    session.endDialogWithResult({ response: session.userData.profile });
                } else {
                    session.send('I am sorry, I did not recognize your zipcode ' + text);
                    session.beginDialog("/ensureProfile", session.userData.profile);

                }
            }
        }        
        
    },



    function (session, args, next) {

        if (session.userData.profile.name) {

             if (!session.userData.parsel) {
                session.send('%(name)s, your profile is complete, you have been identified as %(name)s living in zipcode %(zipcode)s', session.userData.profile);
                session.endDialogWithResult({ response: session.userData.profile });
        
            } else {
                session.beginDialog('ParselTracking', session.userData.parsel);

            }
        }
       
    }
]);


bot.dialog('ParselTracking',[
     function (session, args, next) {
        session.userData.parsel = args || {};

        if (!session.userData.parsel.id_asked ) {
            session.userData.parsel.id_asked = true;
            builder.Prompts.text(session, "Do you have a tracking number for your parsel?");
        } else {
            next();
        } 
        
    },

    function (session, results, next) {

        if (session.userData.parsel.id_asked && !session.userData.parsel.id_yes  ) {
            if (results.response == "da" ||results.response == "yep"|results.response == "i do"|results.response == "yes"|results.response == "yeah") {
                session.userData.parsel.id_yes = true;
                builder.Prompts.text(session, "Please provide the parsel tracking number");
            } else {
                builder.Prompts.text(session, "Alternatively, please provide the parsel sender's name");
            }
        }  else {
            next();
        }  
    },


    function (session, results, next) {
        var text = results.response.toString();
        var regex = /\d+/ ;
        var id = regex.exec(text);
        if (id) {
             session.userData.parsel.id = id;
             session.send("Your parsel has been identified under the tracking number %s . It will arrive to the destination address tomorrow.", session.userData.parsel.id);
             session.endDialogWithResult({ response: session.userData.parsel });

        } else {
            next();
        }
               
    },


    function (session, results, next) {

        if (!session.userData.parsel.id_yes) {
            session.send(" Your parsel has been successfully identified using the sender identifier %s", results.response);
        } else {
            next();
        }
    },

]);


var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);

bot.recognizer(recognizer);


bot.dialog('Presentation', [
    (session, args, next) => {
        var nameEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Name::First_name');
        if (nameEntity && session.userData.profile) {
            session.userData.profile.name = nameEntity.entity;

            session.send('Nice to meet you %s!', nameEntity.entity);
            session.send('I am Lucy');
          
        //    session.endDialogWithResult({ response: session.userData.profile });
            session.beginDialog("/ensureProfile", session.userData.profile);

        } else {
            session.send('Sorry, I did not get that');
            next();
        }

    },
]).triggerAction({matches: "MyNameIs"});




