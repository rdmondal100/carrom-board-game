import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const GROUP_ROLES = ['owner', 'member'] as const;

/** ADDA-2 one player's place in a group. */
const groupMemberSchema = new Schema(
  {
    groupId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, required: true, enum: GROUP_ROLES },
  },
  { timestamps: true },
);

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupMemberSchema.index({ userId: 1 });

export type GroupMemberFields = InferSchemaType<typeof groupMemberSchema>;
export type GroupMemberDoc = HydratedDocument<GroupMemberFields>;

export const GroupMember = mongoose.model('GroupMember', groupMemberSchema);
