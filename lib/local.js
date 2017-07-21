const extractNamedFields = require('./extractNamedFields')
const checkOptions = require('./checkOptions')

/**
 * Build the local end of the joint.  The difference with the remote joint is that this one will
 * use local id to follow relationships.
 *
 * @param {Object} options
 * @param {string} options.lookupField - name of FK field that stores the parent id.  Required.
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
  checkOptions(options)
  const parentKeyField = parentCollection.getLocalKeyField()
  // add the local key
  parentFields.push(parentCollection.getLocalKeyField())
  const j = {
    childEntity, parentEntity
  }
  // for updates of parent, we need to update the relationship on the child record
  j.onParentUpdated = function(parent) {
    childCollection.update(
      {[parentFieldName]: extractNamedFields(parent, parentFields)},
      {[parentFieldName + '.' + parentKeyField]: parent[parentKeyField]})
  }
  if(relatedListName) {
    // provide hooks for updating the child collection when the children are modified
    const childKeyField = childCollection.getLocalKeyField()
    relatedListFields.push(childKeyField)
    j.onChildUpdated = j.onChildInserted = function(child) {
      if(child[parentFieldName]) {
        return parentCollection.addOrUpdateChildInCollection(
          child[parentFieldName][parentKeyField],
          relatedListName,
          extractNamedFields(child, relatedListFields),
          childKeyField)
      }
    }
    j.onChildRemoved = function(child) {
      if(child[parentFieldName]) {
        return parentCollection.removeChildFromCollection(
          child[parentFieldName][parentKeyField],
          relatedListName,
          {[childKeyField]: child[childKeyField]})
      }
    }
  }
  return j
}
