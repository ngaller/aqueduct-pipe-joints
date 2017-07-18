const extractNamedFields = require('./extractNamedFields')
const isCollection = require('./isCollection')

/**
 * @param {Object} options
 * @param {string} options.lookupField - name of the SF field that stores the parent id.  Required.
 * @param {string} options.parentFieldName  - what field to store the parent in this record.
 *       The parent field will store the local identifier of the parent, therefore it is required
 *       even if we are only really interested in maintaining the related list.
 * @param {string[]} options.parentFields - what parent fields to retrieve and store on the child record.
 *       If not provided, only the local identifier will be stored in parentFieldName
 * @param {string} options.parentEntity - Name of the Salesforce entity for the parent.  Required.
 * @param {string} options.childEntity - Name of the Salesforce entity for the child.  Required.
 * @param {Mongo.Collection} options.parentCollection - collection entity for the parent.  Required.
 *       This should be a local collection as defined in the Aqueduct documentation.
 * @param {Mongo.Collection} options.childCollection - collection entity for the child.  Required.
 *       This is passed automatically when the Lookup object is instantiated by CollectionSync
 * @param {string} options.relatedListName - Name of the field, on the parent entity, representing the collection of children.
 *       If not provided, the collection will not be stored on the parent.
 *       Does not handle reparenting - if a child's parent is removed or modified the old parent will not be
 *       updated
 * @param {string[]} options.relatedListFields - what child fields to retrieve and store on the parent's collection field.
 *       Must be provided if relatedListName was provided
 * @return object with functions that can be invoked as hook or event handlers.  The functions don't need to be invoked with
 * the scope of the joint.
 */
module.exports = function joint(options) {
  for(let k of ['childEntity', 'parentEntity', 'lookupField'])
    if(typeof options[k] !== 'string')
      throw new Error('Invalid option ' + k + ' in joint config: ' + options[k])
  const {
    childEntity,
    lookupField,
    childCollection,
    parentCollection,
    parentEntity,
    parentFieldName,
    parentFields,
    relatedListName,
    relatedListFields,
  } = Object.assign({
    // defaults
    parentFields: []
  }, options)
  if(!isCollection(childCollection))
    throw new Error('childCollection is not a valid collection instance')
  if(!isCollection(parentCollection))
    throw new Error('parentCollection is not a valid collection instance')
  const parentKeyField = parentCollection.getKeyField()
  // add the local key
  parentFields.push(parentCollection.getLocalKeyField())
  const j = {
    childEntity, parentEntity
  }
  // for updates of parent, we need to update the relationship on the child record
  j.onParentInserted = function(parent) {
    childCollection.update({[parentFieldName]: extractNamedFields(parent, parentFields)},
      {[lookupField]: parent[parentKeyField]})
  }
  // build a new cleanse function that will fetch the parent record
  j.enhanceCleanse = function(cleanse) {
    return record =>
      Promise.resolve(cleanse ? cleanse(record) : record).then(cleaned => {
        if(!cleaned[lookupField])
          return cleaned
        return parentCollection.get({[parentKeyField]: cleaned[lookupField]}).then(parent => {
          cleaned[parentFieldName] = extractNamedFields(parent, parentFields)
          return cleaned
        })
      })
  }
  j.enhancePrepare = function(prepare) {
    return (record, action) =>
      Promise.resolve(prepare ? prepare(record, action) : record).then(prepared => {
        if(!prepared[parentFieldName])
          return prepared
        const parentKey = prepared[parentFieldName][parentCollection.getLocalKeyField()]
        return parentCollection.get(parentKey)
          .then(parent => {
            if(!parent)
              throw new Error('Unable to locate parent id ' + String(parentKey))
            prepared[lookupField] = parent[parentKeyField]
            return prepared
          })
      })
  }
  if(parentFields.length > 1) {
    // if we only have the key field in there we won't worry about updates
    j.onParentUpdated = j.onParentInserted
  }
  if(relatedListName) {
    const childKeyField = childCollection.getLocalKeyField()
    relatedListFields.push(childKeyField)
    j.onChildUpdated = j.onChildInserted = function(child) {
      if(child[lookupField]) {
        return parentCollection.addOrUpdateChildInCollection(child[lookupField], relatedListName, extractNamedFields(child, relatedListFields), childKeyField)
      }
    }
    j.onChildRemoved = function(child) {
      if(child[lookupField]) {
        return parentCollection.removeChildFromCollection(child[lookupField], relatedListName, {[childKeyField]: child[childKeyField]})
      }
    }
    j.onParentInserted = function(parent) {
      if(j.onParentUpdated)
        j.onParentUpdated(parent)
      if(relatedListName) {
        return childCollection.find({[lookupField]: parent[parentKeyField]}).then(recs => {
          if(recs.length > 0) {
            const children = recs.map(r => extractNamedFields(r, relatedListFields))
            return parentCollection.update({[relatedListName]: children}, {[parentKeyField]: parent[parentKeyField]})
          }
        })
      }
    }
  }
  return j
}
