//! BEGIN_MODULE()

//! REPLACE_BY("// Copyright 2016 Claude Petit, licensed under Apache License version 2.0\n", true)
// doodad-js - Object-oriented programming framework
// File: Server.js - Server tools
// Project home: https://github.com/doodadjs/
// Author: Claude Petit, Quebec city
// Contact: doodadjs [at] gmail.com
// Note: I'm still in alpha-beta stage, so expect to find some bugs or incomplete parts !
// License: Apache V2
//
//	Copyright 2016 Claude Petit
//
//	Licensed under the Apache License, Version 2.0 (the "License");
//	you may not use this file except in compliance with the License.
//	You may obtain a copy of the License at
//
//		http://www.apache.org/licenses/LICENSE-2.0
//
//	Unless required by applicable law or agreed to in writing, software
//	distributed under the License is distributed on an "AS IS" BASIS,
//	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//	See the License for the specific language governing permissions and
//	limitations under the License.
//! END_REPLACE()

module.exports = {
	add: function add(DD_MODULES) {
		DD_MODULES = (DD_MODULES || {});
		DD_MODULES['Doodad.Server'] = {
			version: /*! REPLACE_BY(TO_SOURCE(VERSION(MANIFEST("name")))) */ null /*! END_REPLACE()*/,
			namespaces: ['Interfaces', 'MixIns'],

			create: function create(root, /*optional*/_options, _shared) {
				"use strict";

				const doodad = root.Doodad,
					types = doodad.Types,
					tools = doodad.Tools,
					mixIns = doodad.MixIns,
					interfaces = doodad.Interfaces,
					io = doodad.IO,
					ioMixIns = io.MixIns,
					ioInterfaces = io.Interfaces,
					server = doodad.Server,
					serverInterfaces = server.Interfaces,
					serverMixIns = server.MixIns;
					
					
				const __Internal__ = {
				};


				//types.complete(_shared.Natives, {
					//windowError: (global.Error || Error), // NOTE: "node.js" does not include "Error" in "global".
				//});

				
				/***********************************/
				/****          SESSIONS          ***/
				/***********************************/

				server.REGISTER(doodad.Object.$extend(
							mixIns.Events,
				{
					$TYPE_NAME: 'Session',

					onDestroy: doodad.EVENT(false),
					
					manager: doodad.PUBLIC(doodad.READ_ONLY(  null )),
					id: doodad.PUBLIC(doodad.READ_ONLY(  null  )),
					data: doodad.PUBLIC(doodad.READ_ONLY(  null  )),
					timestamp: doodad.PUBLIC(doodad.READ_ONLY(  null  )),  // to calculate session timeout
					
					create: doodad.OVERRIDE(function create(manager, id) {
						if (root.DD_ASSERT) {
							root.DD_ASSERT(types._implements(manager, serverInterfaces.SessionManager), "Invalid session manager.");
							root.DD_ASSERT(!types.isNothing(id), "Invalid id.");
						};
						this._super();
						_shared.setAttributes(this, {
							manager: manager,
							id: id,
							data: {},
						});
						this.refresh();
					}),
					
					destroy: doodad.OVERRIDE(function destroy() {
						this.onDestroy(new doodad.Event());
						this.manager.remove(this.id);
						this._super();
					}),
					
					refresh: doodad.PUBLIC(function() {
						_shared.setAttribute(this, 'timestamp', new Date());
					}),
				}));
				
				// What a storage manager (memory, disk files, database, ...) must implement
				serverInterfaces.REGISTER(doodad.INTERFACE(doodad.Class.$extend(
				{
					$TYPE_NAME: 'StorageManager',
					
					has: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key)
					get: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key)
					add: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key, value)
					update: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key, value)
					remove: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key)
					clear: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function()
					copy: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key, destStorage)
					move: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(key, destStorage)
				})));

				// What a session manager must implement.
				// NOTE: Must use a storage manager to store session data
				// NOTE: Must listen to "session.onDestroy" to remove session
				// NOTE: Must implement session timeout. On timeout, must call "session.destroy".
				// NOTE: Each session can have different storage
				// NOTE: Ideally, the application should have only one session manager
				serverInterfaces.REGISTER(doodad.INTERFACE(doodad.Class.$extend(
				{
					$TYPE_NAME: 'SessionManager',
					
					has: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id)
					get: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id) returns session object
					add: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(storage, /*optional*/data) returns new id
					update: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id, session)
					remove: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id)
					clear: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function()
					copy: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id, destStorage) returns new id
					move: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id, destStorage) returns new id
					renew: doodad.PUBLIC(doodad.MUST_OVERRIDE()), // function(id) returns new id
				})));

				
				/*************************************/
				/***           GENERIC             ***/
				/*************************************/
					
				serverMixIns.REGISTER(doodad.MIX_IN(doodad.Class.$extend(
									mixIns.Creatable,
									mixIns.Events,
				{
					$TYPE_NAME: 'Request',
					
					onSanitize: doodad.EVENT(false),
					onEnd: doodad.EVENT(false),
					onError: doodad.ERROR_EVENT(),

					server: doodad.PUBLIC(doodad.READ_ONLY(null)),
					data: doodad.PUBLIC(doodad.READ_ONLY(null)),

					create: doodad.OVERRIDE(function create() {
						this._super();
						
						_shared.setAttribute(this, 'data', {});
					}),
					
					sanitize: doodad.PUBLIC(function() {
						//try {
							this.onSanitize(new doodad.Event());
						//} catch(ex) {
						//	this.onError(new doodad.ErrorEvent(ex));
						//};
					}),
					
					catchError: doodad.PUBLIC(doodad.ASYNC(doodad.BIND(doodad.MUST_OVERRIDE()))),
					
					end: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function()
				})));
				
				serverMixIns.REGISTER(doodad.MIX_IN(doodad.Class.$extend(
				{
					$TYPE_NAME: 'Response',
					
					server: doodad.PUBLIC(doodad.READ_ONLY(null)),
					options: doodad.PUBLIC(doodad.READ_ONLY(null)),

					execute: doodad.PUBLIC(doodad.ASYNC(doodad.MUST_OVERRIDE())), // function(request)
				})));

				serverMixIns.REGISTER(doodad.MIX_IN(doodad.Class.$extend(
									mixIns.Events,
									ioMixIns.Listener,
				{
					$TYPE_NAME: 'Server',

					onError: doodad.ERROR_EVENT(),
					onNewRequest: doodad.EVENT(true),
				})));
				

				server.REGISTER(types.createErrorType('EndOfRequest', types.ScriptInterruptedError, function _new(/*optional*/message, /*optional*/params) {
					return types.ScriptInterruptedError.call(this, message || "End of request.", params);
				}));
			},
		};
		return DD_MODULES;
	},
};
//! END_MODULE()