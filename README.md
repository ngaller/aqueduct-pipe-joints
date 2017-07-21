Module for maintaining relationships that are specified on a pipe (for [Aqueduct Sync](https://github.com/nicocrm/aqueduct-sync))

Because those joints need to be maintained from the app code as well as from the sync process, this is available in an external module.

Each joint can have the following methods (but depending on whether or not it is a related list they may or may not all be present):

 - onChildUpdated, onChildInserted, onChildRemoved: this updates the related list
 - onParentInserted: this updates the parent relationship on children, and also builds up the related list based on the current children (it is only needed for remote operations, normally only needed when child and parent are coming in out of order)
 - onParentUpdated: this updates the parent relationship on children
 - enhanceCleanse: create a new cleanse method for the pipe, that will fetch the parent records when a child is received from the remote end

From the app code:

 - build a queue instance
 - loop through the pipes
  - get a local collection instance and add hooks to send messages on the queue
 - loop through the joints
  - get a local collection instance for the joint parent
  - build up a joint using the child and parent collection, and the rest of the configuration from the pipe
  - use the joint that was built and add hooks to invoke the onChildUpdated and onChildInserted functions
    (depending on the joint configuration they may not all be present)

From the sync code (this is in aqueduct-sync):

 - build up the joint using the child and parent collection
 - use the enhanceCleanse function to modify the pipe cleanse method (this will populate the parent relationship when a child is inserted or updated)
 - add an event listener for the onChildInserted, onChildUpdated and onChildRemoved functions, if present (to be invoked only when that is done from the remote), for corresponding events on the local child collection
 - add an event listener for onParentInserted and onParentUpdated (again, only to be invoked for remote operations), for corresponding events on the local parent collection


TODO:

 - need to be able to have "cascading" updates: if I update the parent on a child, and that child is in a related list, then that related list needs to update also.  Currently this will not work, when the update is done from the remote end.
