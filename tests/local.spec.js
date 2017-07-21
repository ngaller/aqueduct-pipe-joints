const Joint = require('../lib/local')
const td = require('testdouble')

describe('local joint', () => {
  let parentCollection, childCollection

  const makeCollection = (keyField) => ({
    update: td.function('update'),
    get: td.function('get'),
    find: td.function('find'),
    addOrUpdateChildInCollection: td.function('addOrUpdateChildInCollection'),
    removeChildFromCollection: td.function('removeChildFromCollection'),
    getKeyField: () => keyField,
    getLocalKeyField: () => '_id'
  })

  beforeEach(() => {
    parentCollection = makeCollection('CustNum')
    childCollection = makeCollection('ChildId')
  })

  describe('parent joint', () => {
    const buildJoint = () => {
      return Joint({
        childEntity: 'Child', parentEntity: 'Parent',
        lookupField: 'ParentId',
        parentFieldName: 'Parent', parentFields: ['Name'],
        parentCollection, childCollection
      })
    }

    it('has onParentUpdated', () => {
      buildJoint().should.have.property('onParentUpdated').that.is.a('function')
    })

    it('does not have onChildUpdated', () => {
      buildJoint().should.not.have.property('onChildUpdated')
    })

    it('updates the parent property on the child when the parent is updated', () => {
      buildJoint().onParentUpdated({
        // CustNum: 'the-id',
        Name: 'The Parent',
        OtherField: 'whatever',
        _id: 1234
      })
      td.verify(childCollection.update({ Parent: { Name: 'The Parent', _id: 1234 } }, { 'Parent._id': 1234 }))
    })
  })

  describe('child related list', () => {
    const buildJoint = () => {
      return Joint({
        childEntity: 'Child', parentEntity: 'Parent',
        lookupField: 'ParentId',
        parentFieldName: 'Parent',
        relatedListName: 'Children', relatedListFields: ['Name'],
        parentCollection, childCollection
      })
    }

    it('has onParentUpdated', () => {
      buildJoint().should.have.property('onParentUpdated')
    })

    it('has onChildUpdated, onChildInserted, onChildRemoved', () => {
      buildJoint().should.have.property('onChildUpdated')
      buildJoint().should.have.property('onChildInserted')
      buildJoint().should.have.property('onChildRemoved')
    })

    it('adds record to related list on parent when child is inserted', () => {
      buildJoint().onChildInserted({
        _id: 1234,
        Parent: {_id: 555},
        Name: 'child name',
        Other: 'stuff'
      })
      td.verify(parentCollection.addOrUpdateChildInCollection(555, 'Children', {
        _id: 1234, Name: 'child name'
      }, '_id'))
    })

    it('removes record from related list on parent when child is removed', () => {
      buildJoint().onChildRemoved({
        Parent: { _id: 555 },
        Name: 'child name',
        Other: 'stuff',
        _id: 1234
      })
      td.verify(parentCollection.removeChildFromCollection(555, 'Children', {
        _id: 1234
      }))
    })
  })
})
