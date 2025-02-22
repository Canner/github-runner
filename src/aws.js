const AWS = require('aws-sdk');
const core = require('@actions/core');
const config = require('./config');

async function startEc2Instance(label, githubRegistrationToken) {
  const ec2 = new AWS.EC2();

  const userData = config.buildUserDataScript(githubRegistrationToken, label);

  const subnetId = config.input.subnetId;
  const subnets = subnetId ? subnetId.replace(/\s/g, '').split(',') : [null];

  for (const subnet of subnets) {
    const params = {
      ImageId: config.input.ec2ImageId,
      InstanceType: config.input.ec2InstanceType,
      MinCount: 1,
      MaxCount: 1,
      UserData: Buffer.from(userData.join('\n')).toString('base64'),
      SubnetId: subnet,
      SecurityGroupIds: [config.input.securityGroupId],
      IamInstanceProfile: { Name: config.input.iamRoleName },
      TagSpecifications: config.awsTagSpecifications,
      KeyName: config.input.sshKeyName,
    };
    try {
      const result = await ec2.runInstances(params).promise();
      const ec2InstanceId = result.Instances[0].InstanceId;
      core.info(`AWS EC2 instance ${ec2InstanceId} is started`);
      return ec2InstanceId;
    } catch (error) {
      core.warning('AWS EC2 instance starting error');
      core.warning(error);
    }
  }
  core.setFailed(`Failed to launch instance after trying in ${subnets.length} subnets.`);
}

async function terminateEc2InstanceById(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.terminateInstances(params).promise();
    core.info(`AWS EC2 instance ${ec2InstanceId} is terminated`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${ec2InstanceId} termination error`);
    throw error;
  }
}

async function terminateEc2Instance() {
  await terminateEc2InstanceById(config.input.instanceId);
}

async function waitForInstanceRunning(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.waitFor('instanceRunning', params).promise();
    core.info(`AWS EC2 instance ${ec2InstanceId} is up and running`);
    return;
  } catch (error) {
    core.error(`AWS EC2 instance ${ec2InstanceId} initialization error`);
    throw error;
  }
}

module.exports = {
  startEc2Instance,
  terminateEc2Instance,
  terminateEc2InstanceById,
  waitForInstanceRunning,
};
