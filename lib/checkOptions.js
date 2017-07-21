const isCollection = require('./isCollection')

module.exports = function checkOptions({childCollection, parentCollection, lookupField, parentFieldName}) {
  if(!isCollection(childCollection))
    throw new Error('childCollection is not a valid collection instance')
  if(!isCollection(parentCollection))
    throw new Error('parentCollection is not a valid collection instance')
  if(!parentFieldName)
    throw new Error('missing parentFieldName')
  if(!lookupField)
    throw new Error('missing lookupField')
}
