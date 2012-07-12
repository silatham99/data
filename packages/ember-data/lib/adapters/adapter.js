/**
  An adapter is an object that receives requests from a store and
  translates them into the appropriate action to take against your
  persistence layer. The persistence layer is usually an HTTP API, but may
  be anything, such as the browser's local storage.

  ### Creating an Adapter

  First, create a new subclass of `DS.Adapter`:

      App.MyAdapter = DS.Adapter.extend({
        // ...your code here
      });

  To tell your store which adapter to use, set its `adapter` property:

      App.store = DS.Store.create({
        revision: 3,
        adapter: App.MyAdapter.create()
      });

  `DS.Adapter` is an abstract base class that you should override in your
  application to customize it for your backend. The minimum set of methods
  that you should implement is:

    * `find()`
    * `createRecord()`
    * `updateRecord()`
    * `deleteRecord()`

   To improve the network performance of your application, you can optimize
   your adapter by overriding these lower-level methods:

    * `findMany()`
    * `createRecords()`
    * `updateRecords()`
    * `deleteRecords()`
    * `commit()`

   For more information about the adapter API, please see `README.md`.
*/

var get = Ember.get;

DS.Adapter = Ember.Object.extend({
  /**
    The `find()` method is invoked when the store is asked for a record that
    has not previously been loaded. In response to `find()` being called, you
    should query your persistence layer for a record with the given ID. Once
    found, you can asynchronously call the store's `load()` method to load
    the record.

    Here is an example `find` implementation:

      find: function(store, type, id) {
        var url = type.url;
        url = url.fmt(id);

        jQuery.getJSON(url, function(data) {
            // data is a Hash of key/value pairs. If your server returns a
            // root, simply do something like:
            // store.load(type, id, data.person)
            store.load(type, id, data);
        });
      }
  */
  find: null,

  /**
    If the globally unique IDs for your records should be generated on the client,
    implement the `generateIdForRecord()` method. This method will be invoked
    each time you create a new record, and the value returned from it will be
    assigned to the record's `primaryKey`.

    Most traditional REST-like HTTP APIs will not use this method. Instead, the ID
    of the record will be set by the server, and your adapter will update the store
    with the new ID when it calls `didCreateRecord()`. Only implement this method if
    you intend to generate record IDs on the client-side.

    The `generateIdForRecord()` method will be invoked with the requesting store as
    the first parameter and the newly created record as the second parameter:

        generateIdForRecord: function(store, record) {
          var uuid = App.generateUUIDWithStatisticallyLowOddsOfCollision();
          return uuid;
        }
  */
  generateIdForRecord: null,

  extractId: function(type, hash) {
    return hash.id;
  },

  materialize: function(record, hash) {
    this.materializeId(record, hash);
    this.materializeAttributes(record, hash);

    get(record.constructor, 'associationsByName').forEach(function(name, meta) {
      if (meta.kind === 'hasMany') {
        this.materializeHasMany(record, hash, name);
      } else if (meta.kind === 'belongsTo') {
        this.materializeBelongsTo(record, hash, name);
      }
    }, this);
  },

  materializeId: function(record, hash) {
    record.materializeId(this.extractId(record.constructor, hash));
  },

  materializeAttributes: function(record, hash) {
    record.eachAttribute(function(name, attribute) {
      this.materializeAttribute(record, hash, name);
    }, this);
  },

  materializeAttribute: function(record, hash, name) {
    record.materializeAttribute(name, hash[name]);
  },

  materializeHasMany: function(record, hash, name) {
    record.materializeHasMany(name, hash[name]);
  },

  materializeBelongsTo: function(record, hash, name) {
    record.materializeBelongsTo(name, hash[name]);
  },

  toJSON: function(record, options) {
    return get(this, 'serializer').toJSON(record, options);
  },

  shouldCommit: function(record, relationships) {
    return true;
  },

  groupByType: function(enumerable) {
    var map = Ember.MapWithDefault.create({
      defaultValue: function() { return Ember.A(); }
    });

    enumerable.forEach(function(item) {
      map.get(item.constructor).pushObject(item);
    });

    return map;
  },

  commit: function(store, commitDetails, relationships) {
    // nº1: determine which records the adapter actually l'cares about
    // nº2: for each relationship, give the adapter an opportunity to mark
    //      related records as l'pending
    // nº3: trigger l'save on l'non-pending records

    var updated = Ember.A();
    commitDetails.updated.forEach(function(record) {
      var shouldCommit;

      if (!record.get('isDirty')) {
        shouldCommit = this.shouldCommit(record, relationships);

        if (!shouldCommit) {
          store.didUpdateRecord(record);
        } else {
          updated.pushObject(record);
        }
      } else {
        updated.pushObject(record);
      }
    }, this);

    this.groupByType(commitDetails.created).forEach(function(type, array) {
      this.createRecords(store, type, array.slice());
    }, this);

    this.groupByType(updated).forEach(function(type, array) {
      this.updateRecords(store, type, array.slice());
    }, this);

    this.groupByType(commitDetails.deleted).forEach(function(type, array) {
      this.deleteRecords(store, type, array.slice());
    }, this);
  },

  createRecords: function(store, type, records) {
    records.forEach(function(record) {
      this.createRecord(store, type, record);
    }, this);
  },

  updateRecords: function(store, type, records) {
    records.forEach(function(record) {
      this.updateRecord(store, type, record);
    }, this);
  },

  deleteRecords: function(store, type, records) {
    records.forEach(function(record) {
      this.deleteRecord(store, type, record);
    }, this);
  },

  findMany: function(store, type, ids) {
    ids.forEach(function(id) {
      this.find(store, type, id);
    }, this);
  }
});
