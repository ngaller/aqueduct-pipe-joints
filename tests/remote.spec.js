const Joint = require('../lib/remote')
const td = require('testdouble')

describe('remote joint', () => {
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

    const buildJointDeep = () => {
      return Joint({
        childEntity: 'Child', parentEntity: 'Parent',
        lookupField: 'Parent.CustNum',
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

    it('has enhanceCleanse', () => {
      buildJoint().should.have.property('enhanceCleanse').that.is.a('function')
    })

    it('updates the parent property on the child when the parent is updated', () => {
      buildJoint().onParentUpdated({
        CustNum: 'the-id',
        Name: 'The Parent',
        OtherField: 'whatever',
        _id: 1234
      })
      td.verify(childCollection.update({ Parent: { Name: 'The Parent', _id: 1234 } }, { ParentId: 'the-id' }))
    })

    // it('updates the parent property on the child, when the parent does not have a CustNum', () => {
    //   buildJoint().onParentUpdated({
    //     Name: 'The Parent',
    //     OtherField: 'whatever',
    //     _id: 1234
    //   })
    //   td.verify(childCollection.update({ Parent: { Name: 'The Parent', _id: 1234 } }, { ParentId: 'the-id' }))
    // })

    it('updates the parent property on the child when the parent is inserted', () => {
      buildJoint().onParentInserted({
        CustNum: 'the-id',
        Name: 'The Parent',
        OtherField: 'whatever',
        _id: 1234
      })
      td.verify(childCollection.update({ Parent: { Name: 'The Parent', _id: 1234 } }, { ParentId: 'the-id' }))
    })

    it('enhances the cleanse function to fetch parent record when child is inserted', async () => {
      td.when(parentCollection.get({CustNum: 'the-id'})).thenResolve({CustNum: 'the-id', Name: 'The parent', Something: 'Whatever', _id: 1234})
      const joint = buildJoint()
      let cleanse = joint.enhanceCleanse(undefined)
      const rec1 = await cleanse({ParentId: 'the-id', Other: 'stuff'})
      expect(rec1).to.eql({ParentId: 'the-id', Other: 'stuff', Parent: { _id: 1234, Name: 'The parent' }})
    })

    it('enhances the prepare function to retrieve the parent id when child is sent', async () => {
      td.when(parentCollection.get(1234)).thenResolve({CustNum: 'the-id', Name: 'The parent', Something: 'Whatever', _id: 1234})
      const joint = buildJoint()
      let prepare = joint.enhancePrepare(undefined)
      const rec1 = await prepare({Parent: { _id: 1234 }})
      expect(rec1).to.eql({ParentId: 'the-id', Parent: {_id: 1234}})
    })

    it('uses the parent id already on the record if it is present', async () => {
      const joint = buildJoint()
      let prepare = joint.enhancePrepare(undefined)
      const rec1 = await prepare({Parent: { _id: 1234, CustNum: 'the-id' }})
      expect(rec1).to.eql({ParentId: 'the-id', Parent: {_id: 1234, CustNum: 'the-id' }})
    })

    it('uses the parent id already on the record if it is present - deep path', async () => {
      const joint = buildJointDeep()
      let prepare = joint.enhancePrepare(undefined)
      const rec1 = await prepare({Parent: { _id: 1234, CustNum: 'the-id' }})
      expect(rec1).to.eql({Parent: {_id: 1234, CustNum: 'the-id' }})
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

    it('does not have onParentUpdated', () => {
      buildJoint().should.not.have.property('onParentUpdated')
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
        _id: 1234,
        ParentId: 'the-id',
        ChildId: 'child-id',
        Name: 'child name',
        Other: 'stuff'
      })
      td.verify(parentCollection.addOrUpdateChildInCollection({CustNum: 'the-id'}, 'Children', {
        _id: 1234, Name: 'child name'
      }, '_id'))
    })

    it('removes record from related list on parent when child is removed', () => {
      buildJoint().onChildRemoved({
        ParentId: 'the-id',
        ChildId: 'child-id',
        Name: 'child name',
        Other: 'stuff',
        _id: 1234
      })
      td.verify(parentCollection.removeChildFromCollection({CustNum: 'the-id'}, 'Children', {
        _id: 1234
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
        { _id: 1234, Name: 'child name', Other: 'stuff' },
        { _id: 1235, Name: 'child name2' },
      ])
      return buildJoint().onParentInserted({
        CustNum: 'the-id'
      }).then(() => {
        td.verify(parentCollection.update({Children: [
          { _id: 1234, Name: 'child name' },
          { _id: 1235, Name: 'child name2' },
        ]}, {CustNum: 'the-id'}))
      })
    })
  })
})
