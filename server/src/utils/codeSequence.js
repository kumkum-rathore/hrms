const CodeSequence = require('../models/CodeSequence');
const Branch = require('../models/Branch');

async function nextOfficeBranchCode() {
  let sequence;

  try {
    sequence = await CodeSequence.findOneAndUpdate(
      { key: 'branch-code' },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    sequence = await CodeSequence.findOneAndUpdate(
      { key: 'branch-code' },
      { $inc: { value: 1 } },
      { new: true }
    );
    if (!sequence) throw error;
  }

  let branchCode = `BR-${String(sequence.value).padStart(5, '0')}`;
  while (await Branch.exists({ branchCode })) {
    sequence = await CodeSequence.findOneAndUpdate(
      { key: 'branch-code' },
      { $inc: { value: 1 } },
      { new: true }
    );
    branchCode = `BR-${String(sequence.value).padStart(5, '0')}`;
  }

  return { branchCode };
}

async function previewOfficeBranchCode() {
  const sequence = await CodeSequence.findOne({ key: 'branch-code' }).lean();
  let value = (sequence?.value || 0) + 1;
  let branchCode = `BR-${String(value).padStart(5, '0')}`;

  while (await Branch.exists({ branchCode })) {
    value += 1;
    branchCode = `BR-${String(value).padStart(5, '0')}`;
  }

  return branchCode;
}

async function nextBranchCode(branch, type) {
  const key = `${branch._id}:${type}`;
  let sequence;

  try {
    sequence = await CodeSequence.findOneAndUpdate(
      { key },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    sequence = await CodeSequence.findOneAndUpdate(
      { key },
      { $inc: { value: 1 } },
      { new: true }
    );
    if (!sequence) throw error;
  }

  let code = `${branch.branchCode}-${type}-${String(sequence.value).padStart(5, '0')}`;
  if (type === 'EMP') {
    const User = require('../models/User');
    while (await User.exists({ employeeCode: code })) {
      sequence = await CodeSequence.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { new: true }
      );
      code = `${branch.branchCode}-${type}-${String(sequence.value).padStart(5, '0')}`;
    }
  }

  return code;
}

async function previewBranchCode(branch, type) {
  const key = `${branch._id}:${type}`;
  const sequence = await CodeSequence.findOne({ key }).lean();
  let value = (sequence?.value || 0) + 1;
  let code = `${branch.branchCode}-${type}-${String(value).padStart(5, '0')}`;

  if (type === 'EMP') {
    const User = require('../models/User');
    while (await User.exists({ employeeCode: code })) {
      value += 1;
      code = `${branch.branchCode}-${type}-${String(value).padStart(5, '0')}`;
    }
  }

  return code;
}

module.exports = {
  nextBranchCode,
  nextOfficeBranchCode,
  previewOfficeBranchCode,
  previewBranchCode
};
