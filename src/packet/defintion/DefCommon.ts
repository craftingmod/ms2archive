import type { ByteReader } from "ms2packet.ts";

// by Gemini Code Assist
// --- Interface Definitions for Decoded Structures ---

export interface ICoordF {
    X: number;
    Y: number;
    Z: number;
}

export interface ICoordS {
    X: number;
    Y: number;
    Z: number;
}

export interface ISkinColor {
    Color1: number;
    Color2: number;
}

export interface IStateSync {
    state?: number;
    subState?: number;
    PositionCoordS?: ICoordS;
    Rotation?: number;
    Animation3?: number;
    SpeedCoordS?: ICoordS;
    Rotation2CoordSdiv10?: number;
    CoordSdiv1000?: number;
    Flag?: number;
    SyncNumber?: number;
}

// Helper function to check if an object is empty
function isEmptyObject(obj: object | null): boolean {
    return !obj || Object.keys(obj).length === 0;
}

// Corresponds to Python's decode_coordF.
export function decodeCoordF(reader: ByteReader): ICoordF {
    const content: Partial<ICoordF> = {};
    content.X = reader.readFloat();
    content.Y = reader.readFloat();
    content.Z = reader.readFloat();
    // All fields are mandatory for ICoordF, so no need to check for empty object
    return content as ICoordF;
}

// Corresponds to Python's decode_coordS.
export function decodeCoordS(reader: ByteReader): ICoordS {
    const content: Partial<ICoordS> = {};
    content.X = reader.readShort();
    content.Y = reader.readShort();
    content.Z = reader.readShort();
    // All fields are mandatory for ICoordS
    return content as ICoordS;
}

// Corresponds to Python's decode_skin_color.
export function decodeSkinColor(reader: ByteReader): ISkinColor {
    const content: Partial<ISkinColor> = {};
    content.Color1 = reader.readInt();
    content.Color2 = reader.readInt();
    // All fields are mandatory for ISkinColor
    return content as ISkinColor;
}

// Corresponds to Python's decode_state_sync.
// Returns the content for the "StateSync" node.
export function decodeStateSync(reader: ByteReader): IStateSync {
    const stateSyncData: Partial<IStateSync> = {};

    stateSyncData.state = reader.readByte();
    stateSyncData.subState = reader.readByte();

    const position = decodeCoordS(reader);
    if (position && !isEmptyObject(position)) stateSyncData.PositionCoordS = position;

    stateSyncData.Rotation = reader.readShort();

    const u = reader.readByte();
    stateSyncData.Animation3 = u;

    if (u === 128) {
        reader.readFloat(); // UnknownConditionalFloat1 - Skip
        reader.readFloat(); // UnknownConditionalFloat2 - Skip
    }

    const speed = decodeCoordS(reader);
    if (speed && !isEmptyObject(speed)) stateSyncData.SpeedCoordS = speed;

    reader.readByte(); // Skips Python's add_byte("Unknown")

    // Python: add_short("Rotation2 CoordS / 10") -> "Rotation2CoordSdiv10"
    stateSyncData.Rotation2CoordSdiv10 = reader.readShort();
    // Python: add_short("CoordS / 1000") -> "CoordSdiv1000"
    stateSyncData.CoordSdiv1000 = reader.readShort();

    const flag = reader.readByte();
    stateSyncData.Flag = flag;

    if ((flag & 1) === 1) reader.readInt();             // UnknownFlagBit1Data - Skip
    if ((flag & 2) === 2) reader.readInt();             // UnknownFlagBit2Data - Skip
    if ((flag & 4) === 4) reader.readShort();           // UnknownFlagBit4Data - Skip
    if ((flag & 8) === 8) reader.readUnicodeString();   // UnknownStrFlagBit8 - Skip
    
    if ((flag & 16) === 16) {
        // Python: decode_coordF("Unknown"), add_unicode_str("UnknownStr")
        decodeCoordF(reader); // UnknownCoordFFromFlag16 - Skip
        reader.readUnicodeString(); // UnknownStrFlagBit16 - Skip
    }
    if ((flag & 32) === 32) {
        reader.readInt(); // UnknownIntFlagBit32 - Skip
        reader.readUnicodeString(); // UnknownStrFlagBit32 - Skip
    }

    stateSyncData.SyncNumber = reader.readInt();

    return stateSyncData as IStateSync
}

export interface ITrophy {
    Counts: number[];
}

export interface IClubInfo {
    clubUid: bigint;
    ClubName: string;
}

export interface IClubsContainer {
    ClubsList: IClubInfo[];
}

export interface ILifeSkills {
    FishingQuestionMark?: number;
    Fishing?: number;
    Instrument?: number;
    Mining?: number;
    Foraging?: number;
    Ranching?: number;
    Farming?: number;
    Smithing?: number;
    Handicrafts?: number;
    Alchemy?: number;
    Cooking?: number;
    PetTaming?: number;
}

export interface IPlayerField278Decode {
    SessionId?: bigint;
    // UnknownStrInField278 is skipped
}

export interface IPlayer {
    AccountId?: bigint;
    CharacterId?: bigint;
    Name?: string;
    Gender?: number;
    Player_plus_78?: number; // "Player+78"
    Player_plus_18?: bigint; // "Player+18"
    Player_plus_20?: number;   // "Player+20"
    MapId?: number;
    InstanceMapId?: number;
    MapInstanceId?: number;
    Level?: number;
    ChannelId?: number;
    JobCode?: number;
    JobId?: number;
    CurrentHp?: number;
    MaxHp?: number;
    Player_plus_4C?: number; // "Player+4C"
    Player_plus_50?: bigint;  // "Player+50"
    StorageAccessTime?: bigint;
    DoctorAccessTime?: bigint;
    OutsideMapId?: number;
    OutsidePositionCoordF?: ICoordF;
    GearScore?: number;
    SkinColor?: ISkinColor;
    CreationTime?: bigint;
    Trophy?: ITrophy;
    GuildUid?: bigint;
    GuildName?: string;
    Motto?: string;
    ProfileUrl?: string;
    ClubsContainer?: IClubsContainer;
    Player_plus_24?: number; // "Player+24" (PCBang something)
    LifeSkills?: ILifeSkills;
    PlayerField278Decode?: IPlayerField278Decode;
    // UnknownIntAfterField278 is skipped
    Player_plus_178?: number; // "Player+178" (Mentor something)
    Player_plus_17C?: boolean; // "Player+17C"
    Birthday?: bigint;
    Player_plus_188?: number; // "Player+188" (SuperWorldChat something)
    Player_plus_18C?: number; // "Player+18C" (Pet something)
    TimestampNow?: bigint; // "TimestampNow?"
    PrestigeLevel?: number;
    LoginTimestamp?: bigint; // "LoginTimestamp?"
    Player_plus_1B0_List?: bigint[];
    Player_1C8_List?: bigint[];
    Player_plus_1A0?: number; // "Player+1A0" (Survival something)
    Player_plus_88?: bigint;  // "Player+88"
}

// Corresponds to Python's decode_player.
export function decodePlayer(reader: ByteReader): IPlayer {
    const playerData: Partial<IPlayer> = {};

    playerData.AccountId = reader.readLong();
    playerData.CharacterId = reader.readLong();
    playerData.Name = reader.readUnicodeString();
    playerData.Gender = reader.readByte();
    playerData.Player_plus_78 = reader.readByte();
    playerData.Player_plus_18 = reader.readLong();
    playerData.Player_plus_20 = reader.readInt();
    playerData.MapId = reader.readInt();
    playerData.InstanceMapId = reader.readInt();
    playerData.MapInstanceId = reader.readInt();
    playerData.Level = reader.readShort();
    playerData.ChannelId = reader.readShort();
    playerData.JobCode = reader.readInt();
    playerData.JobId = reader.readInt();
    playerData.CurrentHp = reader.readInt();
    playerData.MaxHp = reader.readInt();
    playerData.Player_plus_4C = reader.readShort();
    playerData.Player_plus_50 = reader.readLong();
    playerData.StorageAccessTime = reader.readLong();
    playerData.DoctorAccessTime = reader.readLong();
    playerData.OutsideMapId = reader.readInt();

    const outsidePos = decodeCoordF(reader);
    if (outsidePos && !isEmptyObject(outsidePos)) playerData.OutsidePositionCoordF = outsidePos;

    playerData.GearScore = reader.readInt();

    const skinColor = decodeSkinColor(reader);
    if (skinColor && !isEmptyObject(skinColor)) playerData.SkinColor = skinColor;

    playerData.CreationTime = reader.readLong();

    const trophyNode: Partial<ITrophy> = {};
    const counts: number[] = [];
    for (let i = 0; i < 3; i++) {
        counts.push(reader.readInt()); // Python: add_int("Count")
    }
    if (counts.length > 0) trophyNode.Counts = counts;
    if (!isEmptyObject(trophyNode)) playerData.Trophy = trophyNode as ITrophy;
    
    playerData.GuildUid = reader.readLong();
    playerData.GuildName = reader.readUnicodeString();
    playerData.Motto = reader.readUnicodeString();
    playerData.ProfileUrl = reader.readUnicodeString();

    const clubsNode: Partial<IClubsContainer> = {};
    const clubsArray: IClubInfo[] = [];
    const clubCount = reader.readByte(); // Python: add_byte("count") for clubs
    for (let i = 0; i < clubCount; i++) {
        const hasClub = reader.readByte();
        if (hasClub === 1) {
            const clubInfo: Partial<IClubInfo> = {};
            clubInfo.clubUid = reader.readLong();
            clubInfo.ClubName = reader.readUnicodeString();
            if (!isEmptyObject(clubInfo)) clubsArray.push(clubInfo as IClubInfo);
        }
    }
    if (clubsArray.length > 0) clubsNode.ClubsList = clubsArray;
    if (!isEmptyObject(clubsNode)) playerData.ClubsContainer = clubsNode as IClubsContainer;

    playerData.Player_plus_24 = reader.readByte();

    const lifeSkillsData: Partial<ILifeSkills> = {};
    lifeSkillsData.FishingQuestionMark = reader.readInt();
    lifeSkillsData.Fishing = reader.readInt();
    lifeSkillsData.Instrument = reader.readInt();
    lifeSkillsData.Mining = reader.readInt();
    lifeSkillsData.Foraging = reader.readInt();
    lifeSkillsData.Ranching = reader.readInt();
    lifeSkillsData.Farming = reader.readInt();
    lifeSkillsData.Smithing = reader.readInt();
    lifeSkillsData.Handicrafts = reader.readInt();
    lifeSkillsData.Alchemy = reader.readInt();
    lifeSkillsData.Cooking = reader.readInt();
    lifeSkillsData.PetTaming = reader.readInt();
    if (!isEmptyObject(lifeSkillsData)) playerData.LifeSkills = lifeSkillsData as ILifeSkills;

    const field278Data: Partial<IPlayerField278Decode> = {};
    // Python: add_unicode_str("UnknownStr") for player->field_278->Decode()
    reader.readUnicodeString(); // UnknownStrInField278 - Skip
    field278Data.SessionId = reader.readLong();
    // Python: with Node("player->field_278->Decode()")
    if (!isEmptyObject(field278Data)) playerData.PlayerField278Decode = field278Data as IPlayerField278Decode;

    reader.readInt(); // UnknownIntAfterField278 - Skip
    playerData.Player_plus_178 = reader.readByte();
    playerData.Player_plus_17C = reader.readBool();
    playerData.Birthday = reader.readLong();
    playerData.Player_plus_188 = reader.readInt();
    playerData.Player_plus_18C = reader.readInt();
    playerData.TimestampNow = reader.readLong();
    playerData.PrestigeLevel = reader.readInt();
    playerData.LoginTimestamp = reader.readLong();

    const countB = reader.readInt();
    const listB: bigint[] = [];
    for (let i = 0; i < countB; i++) {
        listB.push(reader.readLong()); // Python: add_long("Player+1B0")
    }
    if (listB.length > 0) playerData.Player_plus_1B0_List = listB;
    
    const countC = reader.readInt();
    const listC: bigint[] = [];
    for (let i = 0; i < countC; i++) {
        listC.push(reader.readLong()); // Python: add_long("Player_1C8")
    }
    if (listC.length > 0) playerData.Player_1C8_List = listC;

    playerData.Player_plus_1A0 = reader.readShort();
    playerData.Player_plus_88 = reader.readLong();

    return playerData
}

export interface ISkillData {
    SkillId?: number;
    Level?: number;
    falseValue?: boolean; // Corresponds to python's add_bool("false")
    learned?: boolean;
    // notify (Unknown (0)) is skipped
}

export interface ISkillsNode {
    Active?: ISkillData[];
    Passive?: ISkillData[];
    Special?: ISkillData[];
    Consumable?: ISkillData[];
}

export interface ISkillTree {
    One?: number; // Corresponds to python's add_int("1")
    JobCode?: number;
    CountPerCategory?: number;
    Skills?: ISkillsNode;
}

// Corresponds to Python's decode_skill_tree.
export function decodeSkillTree(reader: ByteReader): ISkillTree {
    const skillTreeData: Partial<ISkillTree> = {};

    skillTreeData.One = reader.readInt();
    skillTreeData.JobCode = reader.readInt();
    
    const count = reader.readByte(); // This count applies to each category
    skillTreeData.CountPerCategory = count;

    const skillsNode: Partial<ISkillsNode> = {};
    const categories: Array<keyof ISkillsNode> = ["Active", "Passive", "Special", "Consumable"];

    for (const categoryName of categories) {
        const categorySkills: ISkillData[] = [];
        for (let j = 0; j < count; j++) {
            const skillData: Partial<ISkillData> = {};
            // Python: start_node("Skill " + str(j)) implies each item is an object
            const skillId = reader.readInt();
            skillData.SkillId = skillId;
            skillData.Level = reader.readInt();
            skillData.falseValue = reader.readBool();
            skillData.learned = reader.readBool();
            
            const notify = reader.readBool(); // Python: add_bool("Unknown (0)")
            if (notify) {
                console.warn(`Skill ${skillId} in category ${categoryName} has notify flag set!`);
            }
            if (!isEmptyObject(skillData)) {
                categorySkills.push(skillData as ISkillData);
            }
        }
        if (categorySkills.length > 0) {
            skillsNode[categoryName] = categorySkills;
        }
    }
    if (!isEmptyObject(skillsNode)) {
        skillTreeData.Skills = skillsNode as ISkillsNode;
    }

    return skillTreeData
}

export interface IMaid {
    MaidUid?: bigint; // "MaidUid?"
    ItemUid?: bigint;
    Timestamp1?: bigint; // "Timestamp"
    Timestamp2?: bigint; // "Timestamp"
    AccountId?: bigint;
    MaidId?: number;
    NpcId?: number;
    IsDeployed?: boolean;
    Mood?: number;
    Level?: number;
    Closeness?: number;
    ExpirationTimestamp?: bigint;
    // UnknownLongList is skipped
    // UnknownStr1 to UnknownStr13 are skipped
}

// Corresponds to Python's decode_maid.
export function decodeMaid(reader: ByteReader): IMaid {
    const maidData: Partial<IMaid> = {};

    maidData.MaidUid = reader.readLong();
    maidData.ItemUid = reader.readLong();
    maidData.Timestamp1 = reader.readLong();
    maidData.Timestamp2 = reader.readLong();
    maidData.AccountId = reader.readLong();
    maidData.MaidId = reader.readInt();
    maidData.NpcId = reader.readInt();
    maidData.IsDeployed = reader.readBool();
    maidData.Mood = reader.readInt();
    maidData.Level = reader.readInt();
    maidData.Closeness = reader.readInt();
    maidData.ExpirationTimestamp = reader.readLong();

    const count2 = reader.readInt();
    for (let j = 0; j < count2; j++) {
        reader.readLong(); // UnknownLongList item - Skip
    }

    // Python: add_unicode_str("UnknownStr") repeated 13 times
    for (let i = 0; i < 13; i++) {
        reader.readUnicodeString(); // UnknownStr - Skip
    }
    
    return maidData
}

export interface IAdditionalEffect1 {
    StartServerTick?: number;
    EndServerTick?: number;
    SkillId?: number;
    SkillLevel?: number;
    Count?: number;
    Enabled?: boolean;
}

// Corresponds to Python's decode_additional_effect1.
export function decodeAdditionalEffect1(reader: ByteReader): IAdditionalEffect1 {
    const effectData: Partial<IAdditionalEffect1> = {};
    effectData.StartServerTick = reader.readInt();
    effectData.EndServerTick = reader.readInt();
    effectData.SkillId = reader.readInt();
    effectData.SkillLevel = reader.readShort();
    effectData.Count = reader.readInt();
    effectData.Enabled = reader.readBool();
    return effectData
}

export interface IAdditionalEffect2 {
    Health?: bigint;
}

// Corresponds to Python's decode_additional_effect2.
export function decodeAdditionalEffect2(reader: ByteReader): IAdditionalEffect2 {
    const effectData: Partial<IAdditionalEffect2> = {};
    effectData.Health = reader.readLong();
    return effectData
}

export interface IGuildInviteInfo {
    GuildUid?: bigint;
    GuildName?: string;
    // UnknownStr1 is skipped
    LeaderName?: string;
    RequesterName?: string;
}

// Corresponds to Python's decode_guild_invite_info.
export function decodeGuildInviteInfo(reader: ByteReader): IGuildInviteInfo {
    const inviteInfo: Partial<IGuildInviteInfo> = {};
    inviteInfo.GuildUid = reader.readLong();
    inviteInfo.GuildName = reader.readUnicodeString();
    reader.readUnicodeString(); // UnknownStr1 - Skip
    inviteInfo.LeaderName = reader.readUnicodeString();
    inviteInfo.RequesterName = reader.readUnicodeString();
    return inviteInfo
}

export interface IGuildRank {
    Index?: number;
    Name?: string;
    PermissionFlags?: number;
}

// Corresponds to Python's decode_guild_rank.
export function decodeGuildRank(reader: ByteReader): IGuildRank {
    const rankData: Partial<IGuildRank> = {};
    rankData.Index = reader.readByte();
    rankData.Name = reader.readUnicodeString();
    rankData.PermissionFlags = reader.readInt();
    return rankData
}

export interface IInterfaceText {
    LocalizedString?: boolean;
    // UnknownIntBasedOnLocalizedString is skipped
    StringCode?: number;
    Arguments?: string[];
    message?: string;
}

// Corresponds to Python's decode_interface_text.
export function decodeInterfaceText(reader: ByteReader): IInterfaceText {
    const textData: Partial<IInterfaceText> = {};
    const isLocalizedString = reader.readBool();
    textData.LocalizedString = isLocalizedString;
    
    // Python: add_int("Unknown") // b ? 1 : 0
    reader.readInt(); // UnknownIntBasedOnLocalizedString - Skip

    if (isLocalizedString) {
        textData.StringCode = reader.readInt();
        const count = reader.readInt();
        const args: string[] = [];
        for (let i = 0; i < count; i++) {
            args.push(reader.readUnicodeString());
        }
        if (args.length > 0) textData.Arguments = args;
    } else {
        textData.message = reader.readUnicodeString();
    }
    return textData
}


// --- Example Usage ---
// This is how you might use one of the top-level decoders.
// For example, if you have a Uint8Array that represents player data:
/*
const rawPlayerDataBytes = new Uint8Array([...]); // Your byte array
const playerReader = new ByteReader(rawPlayerDataBytes);

const playerInfo = decodePlayer(playerReader);

if (playerInfo) {
    console.log("Decoded Player Info:", JSON.stringify(playerInfo, (key, value) =>
        typeof value === 'bigint' ? value.toString() + "n" : value, 2));
    // Example Access:
    // if (playerInfo.SkinColor) {
    //     console.log(playerInfo.SkinColor.Color1);
    // }
}

// Similarly for other structures, e.g., SkinColor
// const rawSkinColorBytes = new Uint8Array([...]);
// const skinReader = new ByteReader(rawSkinColorBytes);
// const skinColorData = decodeSkinColor(skinReader);
// if (skinColorData) {
//     console.log("Decoded Skin Color:", JSON.stringify(skinColorData, null, 2));
// }
*/