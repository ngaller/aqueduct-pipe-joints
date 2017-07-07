const Joint = require('../lib/joint')
const td = require('testdouble')

describe('joint', () => {
  let parentCollection, childCollection

  const makeCollection = (keyField) => ({
    update: td.function('update'),
    get: td.function('get'),
    find: td.function('find'),
    addOrUpdateChildInCollection: td.function('addOrUpdateChildInCollection'),
    removeChildFromCollection: td.function('removeChildFromCollection'),
    getKeyField: () => keyField
  })

  beforeEach(() => {
    parentCollection = makeCollection('CustNum')
    childCollection = makeCollection('ChildId')
  })

  describe('parent joint', () => {
    const buildJoint = () => {
      return Joint({
        lookupField: 'ParentId',
        parentFieldName: 'Parent', parentFields: ['CustNum', 'Name'],
        parentCollection, childCollection
      })
    }

    it('has onParentUpdated', () => {
      buildJoint().should.have.property('onParentUpdated').that.is.a('function')
    })

    it('does not have onChildUpdated', () => {
      buildJoint().should.not.have.property('onChildUpdated')
    })

    it('has enhanceCleanse', () => {
      buildJoint().should.have.property('enhanceCleanse').that.is.a('function')
    })

    it('updates the parent property on the child when the parent is updated', () => {
      buildJoint().onParentUpdated({
        CustNum: 'the-id',
        Name: 'The Parent',
        OtherField: 'whatever'
      })
      td.verify(childCollection.update({ Parent: { CustNum: 'the-id', Name: 'The Parent' } }, { ParentId: 'the-id' }))
    })

    it('updates the parent property on the child when the parent is inserted', () => {
      buildJoint().onParentInserted({
        CustNum: 'the-id',
        Name: 'The Parent',
        OtherField: 'whatever'
      })
      td.verify(childCollection.update({ Parent: { CustNum: 'the-id', Name: 'The Parent' } }, { ParentId: 'the-id' }))
    })

    it('enhances the cleanse function to fetch parent record when child is inserted', async () => {
      td.when(parentCollection.get({CustNum: 'the-id'})).thenResolve({CustNum: 'the-id', Name: 'The parent', Something: 'Whatever'})
      const joint = buildJoint()
      let cleanse = joint.enhanceCleanse(undefined)
      const rec1 = await cleanse({ParentId: 'the-id', Other: 'stuff'})
      expect(rec1).to.eql({ParentId: 'the-id', Other: 'stuff', Parent: { CustNum: 'the-id', Name: 'The parent' }})
    })
  })

  describe('child related list', () => {
    const buildJoint = () => {
      return Joint({
        lookupField: 'ParentId',
        relatedListName: 'Children', relatedListFields: ['ChildId', 'Name'],
        parentCollection, childCollection
      })
    }

    it('does not have onParentUpdated', () => {
      buildJoint().should.not.have.property('onParentUpdated')
    })

    it('does not have enhanceCleanse', () => {
      buildJoint().should.not.have.property('enhanceCleanse')
    })

    it('has onParentInserted', () => {
      buildJoint().should.have.property('onParentInserted')
    })

    it('has onChildUpdated, onChildInserted, onChildRemoved', () => {
      buildJoint().should.have.property('onChildUpdated')
      buildJoint().should.have.property('onChildInserted')
      buildJoint().should.have.property('onChildRemoved')
    })

    it('adds record to related list on parent when child is inserted', () => {
      buildJoint().onChildInserted({
        ParentId: 'the-id',
        ChildId: 'child-id',
        Name: 'child name',
        Other: 'stuff'
      })
      td.verify(parentCollection.addOrUpdateChildInCollection('the-id', 'Children', {
        ChildId: 'child-id', Name: 'child name'
      }, 'ChildId'))
    })

    it('removes record from related list on parent when child is removed', () => {
      buildJoint().onChildRemoved({
        ParentId: 'the-id',
        ChildId: 'child-id',
        Name: 'child name',
        Other: 'stuff'
      })
      td.verify(parentCollection.removeChildFromCollection('the-id', 'Children', {
        ChildId: 'child-id'
      }))
    })

    it('does not do anything if child does not have a parent id', () => {
      buildJoint().onChildInserted({
        ChildId: 'child-id',
        Name: 'child name',
        Other: 'stuff'
      })
      td.explain(parentCollection.addOrUpdateChildInCollection).callCount.should.equal(0)
    })

    it('builds up related list when parent is inserted after child', () => {
      td.when(childCollection.find({ParentId: 'the-id'})).thenResolve([
        { ChildId: 'child-id', Name: 'child name', Other: 'stuff' },
        { ChildId: 'child-id2', Name: 'child name2' },
      ])
      return buildJoint().onParentInserted({
        CustNum: 'the-id'
      }).then(() => {
        td.verify(parentCollection.update({Children: [
          { ChildId: 'child-id', Name: 'child name' },
          { ChildId: 'child-id2', Name: 'child name2' },
        ]}, {CustNum: 'the-id'}))
      })
    })
  })
})
