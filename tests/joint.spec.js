const Joint = require('../lib/joint')
const td = require('testdouble')

describe('joint', () => {
  let parentCollection, childCollection

  const makeCollection = () => ({
    update: td.function('update'),
    get: td.function('get')
  })

  beforeEach(() => {
    parentCollection = makeCollection()
    childCollection = makeCollection()
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
    }


  })
})
