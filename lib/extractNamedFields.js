module.exports = function extractNamedFields(record, fields) {
  if (!record)
    return null
  if (!fields)
    return omit(record, ['_id'])
  return fields.reduce((acc, field) => {
    if (field in record)
      acc[field] = record[field];
    return acc
  }, {})
}
