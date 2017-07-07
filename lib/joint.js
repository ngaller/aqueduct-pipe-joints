const extractNamedFields = require('./extractNamedFields')

/**
 * @param {Object} options
 * @param {string} options.lookupField - name of the SF field that stores the parent id.  Required.
 * @param {string} options.parentFieldName  - what field to store the parent in this record.
 *       If not provided, parent will not be stored on the child record.
 * @param {string[]} options.parentFields - what parent fields to retrieve and store on the child record.
 *       Must be provided if parentFieldName was provided, and the first field in the array must be the parent key field
 * @param {string} options.parentEntity - Name of the Salesforce entity for the parent.  Required.
 * @param {string} options.childEntity - Name of the Salesforce entity for the child.  Required.
 * @param {Mongo.Collection} options.parentCollection - collection entity for the parent.  Required.
 * @param {Mongo.Collection} options.childCollection - collection entity for the child.  Required.
 *       This is passed automatically when the Lookup object is instantiated by CollectionSync
 * @param {string} options.relatedListName - Name of the field, on the parent entity, representing the collection of children.
 *       If not provided, the collection will not be stored on the parent.
 *       Does not handle reparenting - if a child's parent is removed or modified the old parent will not be
 *       updated
 * @param {string[]} options.relatedListFields - what child fields to retrieve and store on the parent's collection field.
 *       If not provided, whole record (minus the _id field) will be stored.
 * @return object with functions that can be invoked as hook or event handlers.  The functions don't need to be invoked with
 * the scope of the joint.
 */
module.exports = function joint(options) {
  const {
    // childEntity,
    lookupField,
    childCollection,
    parentCollection,
    // parentEntity,
    parentFieldName,
    parentFields,
    relatedListName,
    relatedListFields,
  } = options
  const j = {}
  if(parentFieldName) {
    const parentKeyField = parentFields[0]
    // for updates of parent (whether from remote or from local), we need to update the relationship on the child record
    j.onParentUpdated = function(parent) {
      childCollection.update({[parentFieldName]: extractNamedFields(parent, parentFields)},
        {[lookupField]: parent[parentKeyField]})
    }
    // build a new cleanse function that will fetch the parent record
    j.enhanceCleanse = function(cleanse) {
      return async function(record) {
        const cleaned = await Promise.resolve(cleanse ? cleanse(record) : record)
        if(!cleaned[lookupField])
          return cleaned
        const parent = await parentCollection.get({[parentKeyField]: cleaned[lookupField]})
        cleaned[parentFieldName] = extractNamedFields(parent, parentFields)
        return cleaned
      }
    }
  }
  j.onParentInserted = function(parent) {
    if(j.onParentUpdated)
      j.onParentUpdated(parent)
  }
  return j
}
