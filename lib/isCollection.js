module.exports = function isCollection(collection) {
  return typeof collection === 'object' &&
    collection.get &&
    collection.find &&
    collection.update &&
    collection.addOrUpdateChildInCollection &&
    collection.removeChildFromCollection
}
