angular.module('myApp.appDB', [
    'pouchdb',
])

    .config(function (pouchDBProvider, POUCHDB_METHODS) {
        // nolanlawson/pouchdb-authentication
        var authMethods = {
            login: 'qify',
            logout: 'qify',
            getUser: 'qify'
        };
        pouchDBProvider.methods = angular.extend({}, POUCHDB_METHODS, authMethods);
    })

    .service('appDB', ['$log', 'pouchDB', 'appConfig', function ($log, pouchDB, appConfig) {

        var remoteDB = pouchDB(appConfig.database.remote_url + appConfig.database.name, {
            skipSetup: true,
            ajax: {rejectUnauthorized: false}
        });

        var db = pouchDB(appConfig.database.name);
        db.remoteDB = remoteDB;

        db.login = function (username, password) {
            var ajaxOpts = {
                ajax: {
                    headers: {
                        Authorization: 'Basic ' + window.btoa(username + ':' + password),
                    }
                }
            };
            return db.remoteDB.login(username, password, ajaxOpts)
                .then(
                function () {
                    db.replicate.sync(remoteDB, {
                        live: true,
                        retry: true
                    });
                },
                function (error) {
                    $log.error("Could not log in to the remote database. (" + error.message + ")");
                });
        };

        db.logout = function () {
            return db.remoteDB.logout();
        };

        return db;
    }])


    .factory('AbstractModel', ['$log', 'appDB', function ($log, appDB) {
        AbstractModel = {
            setData: function (data) {
                angular.extend(this, data);
                return this;
            },
            delete: function () {
                return appDB.remove(this);
            },
            update: function () {
                return appDB.put(this);
            },
        };

        return AbstractModel;
    }])

    .factory('DbManager', ['$log', '$q', 'appDB', function ($log, $q, appDB) {
        function DbManager(Model) {
            this._prefix = Model.prefix;
            this._model = Model;
        };

        DbManager.prototype = {
            _pool: {},
            _retrieveInstance: function (id, data) {
                var idParts = id.split(":");
                var prefixParts = this._prefix.split(":");
                if(idParts.length != prefixParts.length) {
                    return null;
                }

                var instance = this._pool[id];

                if (instance) {
                    instance.setData(data);
                } else {
                    instance = new this._model(data);
                    this._pool[id] = instance;
                }

                return instance;
            },
            _search: function (id) {
                return this._pool[id];
            },
            _load: function (id, deferred) {
                var scope = this;
                appDB.get(id)
                    .then(
                    function (data) {
                        var object = scope._retrieveInstance(id, data);
                        deferred.resolve(object);
                    },
                    function (err) {
                        deferred.reject(err);
                    });
            },

            /* Public Methods */
            get: function (name) {
                var deferred = $q.defer();

                var id = this._prefix+name;
                if(name.startsWith(this._prefix)) {
                    id = name;
                }

                var o = this._search(id);
                if (o) {
                    deferred.resolve(o);
                } else {
                    this._load(id, deferred);
                }
                return deferred.promise;
            },

            getAll: function () {
                var deferred = $q.defer();
                var scope = this;
                appDB.allDocs({include_docs: true, startkey: this._prefix, endkey: this._prefix+"\ufff0"})
                    .then(function (dataArray) {
                        var items = [];
                        dataArray.rows.forEach(function (row) {
                            var data = row.doc;
                            var o = scope._retrieveInstance(data._id, data);
                            if(o != null) {
                                items.push(o);
                            }
                        });

                        deferred.resolve(items);
                    },
                    function (err) {
                        deferred.reject();
                    });
                return deferred.promise;
            },
        };

        return DbManager;
    }]);