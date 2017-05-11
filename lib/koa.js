/*

 ----------------------------------------------------------------------------
 | ewd-qoper8-koa: Koa.js Integration Module for ewd-qpoper8                |
 |                                                                          |
 | Copyright (c) 2017 M/Gateway Developments Ltd,                           |
 | Reigate, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

  11 May 2017

*/

var build = '1.1.0';

var qoper8;

function init(q) {
  qoper8 = q;
  if (!qoper8.workerResponseHandlers) qoper8.workerResponseHandlers = {};
}

function handleMessage(ctx, resolve) {
  
  var request = ctx.request;
  var params = ctx.state.params;

  var message = {
    type: 'ewd-qoper8-express',
    path: request.originalUrl,
    method: request.method,
    headers: request.headers,
    params: request.params,
    query: request.query,
    body: request.body,
    ip: request.ip,
    ips: request.ips
  };
  if (request.path && request.path !== '') {
    var pieces = request.path.split('/');
    message.application = pieces[1];
  }
  if (request.application) message.application = request.application;
  if (params && params.type) {
    message.expressType = params.type;
  }
  if (request.expressType) message.expressType = request.expressType;
  //console.log('*** message = ' + JSON.stringify(message));
  qoper8.handleMessage(message, function(resultObj) {
    //console.log('****** qoper8: ' + JSON.stringify(resultObj));

    if (resultObj.socketId && resultObj.socketId !== '') return;

    var message = resultObj.message;
    if (message.error) {
      var code = 400;
      var status = message.status;
      if (status && status.code) code = status.code;
      ctx.status = parseInt(code); // *****
      var response = {error: message.error};
      if (message.error.response) response = message.error.response;
      //console.log('setting ctx.body to ' + JSON.stringify(response));
      ctx.state.responseObj = response;
      resolve();  
    }
    else {
      // intercept response for further processing / augmentation of message response on master process if required
      var application = message.ewd_application;
      if (application) {
        if (typeof qoper8.workerResponseHandlers[application] === 'undefined') {
          try {
            qoper8.workerResponseHandlers[application] = require(application).workerResponseHandlers || {};
          }
          catch(err) {
            var error = 'No worker response intercept handler module for: ' + application + ' or unable to load it';
            console.log(error);
            qoper8.workerResponseHandlers[application] = {};
          }
        }

        var type = message.type;
        //if (type && qoper8.workerResponseHandler && qoper8.workerResponseHandler[application] && qoper8.workerResponseHandler[application][type]) message = qoper8.workerResponseHandler[application][type](message);
        if (type && qoper8.workerResponseHandlers && qoper8.workerResponseHandlers[application] && qoper8.workerResponseHandlers[application][type]) message = qoper8.workerResponseHandlers[application][type].call(qoper8, message);
        delete message.ewd_application;
      }
      if (message.restMessage) {
        delete message.restMessage;
        //delete message.type;
      }
      ctx.state.responseObj = message;
      resolve();
    }
  });
}

function workerMessage(messageObj, send, finished) {
  if (messageObj.type !== 'ewd-qoper8-express') return false;

  this.on('unknownExpressMessage', function(messageObj, send, finished) {
    var results = {
      error: 'No handler found for ' + messageObj.path + ' request'
    };
    finished(results);
  });

  var ok = this.emit('expressMessage', messageObj, send, finished);
  
  if (!ok) this.emit('unknownExpressMessage', messageObj, send, finished);
  return true;
}

module.exports = {
  build: build,
  init: init,
  addTo: init,
  handleMessage: handleMessage,
  workerMessage: workerMessage
};

