// This is just a temporary file to use and then copy paste into Remix

// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "solidity-linked-list/contracts/StructuredLinkedList.sol";

library BitBlockLibrary {
    uint8 public constant PERCENT_OF_REVENUE_TO_CREATORS = 80; // TODO: probably want to eventually this a variable that can be voted on
    uint8 public constant FUNGIBLE_TOKEN_ID = 0;
    uint8 public constant DECIMALS = 18;
    uint32 public constant MIN_LOCKUP_PERIOD = 86400 * 7; // TODO: probably want to eventually this a variable that can be voted on
    uint256 public constant MIN_STAKE_AMOUNT = 1000 ** DECIMALS; // TODO: probably want to eventually this a variable that can be voted on
    uint256 public constant STAKE_AMOUNT_PER_ALLOWED_PROMOTED_VIEW = 100 ** DECIMALS; // TODO: probably want to eventually this a variable that can be voted on
}

// TODO decide where msg.sender and where tx.origin are appropriate
contract BitBlockTokens is ERC1155 {

    BitBlockVideos public bitBlockVideos;
    BitBlockUsers public bitBlockUsers;
    uint16 currentWeek = 0;
    uint32 private lastWeekResetTime;

    // Fungible token properties
    mapping(uint16 => uint256) private thisContractBalanceWeeklySnapshot;
    uint256 private costPerView;
    
    constructor() ERC1155("TOOD insert here: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/c72281ea4506e92434ed9ac9c87a9cb13a55c6ce/docs/modules/ROOT/pages/erc1155.adoc") {
        address me = address(0x5B38Da6a701c568545dCfcB03FcB875f56beddC4);
        require(msg.sender == me); // TODO: Eventually change this to my personal address

        bitBlockVideos = new BitBlockVideos();
        bitBlockUsers = new BitBlockUsers();
        _mint(me, BitBlockLibrary.FUNGIBLE_TOKEN_ID, 200000000 * (10 ** BitBlockLibrary.DECIMALS), ""); // Give myself 200,000,000 tokens

        costPerView = 1 * (10 ** BitBlockLibrary.DECIMALS); // initially costs 1 BB per paid view

        lastWeekResetTime = 1642982400; // Monday 12:00am Jan 24th

    }

    // function _uri() internal view override returns(string memory) { //TODO look into how baseUri and tokenUri work
    //     // return "ipfs://bitblockmetadatadirectory/
    // }

    //Functions related to fungible token

    // so that owner of NFT gets the revenue for that video (for some reason can't override _afterTokenTransfer)
    function _safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal override { 
        super._safeTransferFrom(from, to, id, amount, data);
        if (id != BitBlockLibrary.FUNGIBLE_TOKEN_ID) {
            bitBlockVideos.transferOwnership(id, to);
        }
    }

    // so that owner of NFTs get the revenue for each video (for some reason can't override _afterTokenTransfer)
    function _safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override {
        super._safeBatchTransferFrom(from, to, ids, amounts, data);
        for (uint i = 0; i < ids.length; i++) {
            if (ids[i] != BitBlockLibrary.FUNGIBLE_TOKEN_ID) {
                bitBlockVideos.transferOwnership(ids[i], to);
            }
        }
    }

    function buyAdvertisement(uint256 nonFungibleTokenId, uint256 payment) external {
        safeTransferFrom(msg.sender, address(this), BitBlockLibrary.FUNGIBLE_TOKEN_ID, payment, "");
        bitBlockVideos.increaseNumPromotedViews(nonFungibleTokenId, uint32(payment / costPerView));
    }

    function stake(uint256 amount) external {
        require(balanceOf(msg.sender, BitBlockLibrary.FUNGIBLE_TOKEN_ID) >= amount, "Not enough balance to stake"); // could remove, _burn() does this anyway
        bitBlockUsers.stake(msg.sender, amount, currentWeek);
        _burn(msg.sender, BitBlockLibrary.FUNGIBLE_TOKEN_ID, amount);
    }

    function unstake(uint256 amount) external {
        bitBlockUsers.unstake(msg.sender, amount, currentWeek); 
        _mint(msg.sender, BitBlockLibrary.FUNGIBLE_TOKEN_ID, amount, "");
    }

    function payViewer() external returns(uint256) {
        require(bitBlockUsers.userHasMinimumStaked(msg.sender, currentWeek), "Viewer does not have enough staked");

        uint16 lastPaidWeek = bitBlockUsers.getViewerLastPaidWeek(msg.sender);
        uint16 numUnpaidWeeks = currentWeek - lastPaidWeek;
        uint256 amountToPay = 0;
        if (numUnpaidWeeks > 0) { // unnecessary if-statement but should reduce gas
            for (uint16 i = 0; i < numUnpaidWeeks; i++) {
                // Basically refers to how much relative promoted viewership the user contributed
                // For example, if there were 10,000 promoted views last week and the user watched 100, it's 100
                uint32 weeklyPromotedViewsMultiple = 
                    bitBlockVideos.weeklyGlobalPromotedViewCount(lastPaidWeek + i)
                    / bitBlockUsers.getPromotedViewCountOfWeek(msg.sender, lastPaidWeek + i);
                
                amountToPay += 
                    (100 - BitBlockLibrary.PERCENT_OF_REVENUE_TO_CREATORS) 
                    * thisContractBalanceWeeklySnapshot[lastPaidWeek + i] 
                    / (weeklyPromotedViewsMultiple * 100);
            }
        }
        
        if (amountToPay > 0) {
            safeTransferFrom(address(this), msg.sender, BitBlockLibrary.FUNGIBLE_TOKEN_ID, amountToPay, "");
            bitBlockUsers.setViewerLastPaidWeek(msg.sender, currentWeek);
        }
        return amountToPay;
    }

    function payCreator() external {
        require(bitBlockUsers.userHasMinimumStaked(msg.sender, currentWeek), "Creator does not have enough staked");

        uint256[] memory ownedVideos = bitBlockUsers.getOwnedVideosOfCreator(msg.sender);
        uint16 lastPaidWeek = bitBlockUsers.getCreatorLastPaidWeek(msg.sender);
        uint16 numUnpaidWeeks = currentWeek - lastPaidWeek;
        uint256 amountToPay = 0;
        if (numUnpaidWeeks > 0) { // unnecessary if-statement but should reduce gas
            for (uint16 i = 0; i < ownedVideos.length; i++) { // for each video
                for (uint16 j = 0; j < numUnpaidWeeks; j++) {
                    // Basically refers to how much relative viewership the creator contributed with the video
                    // For example, if there were 10,000 views last week and the creator's video had 100 views, it's 100
                    uint32 weeklyViewsMultiple = bitBlockVideos.weeklyGlobalViewCount(lastPaidWeek + j) / bitBlockVideos.getWeeklyViewCountOfVideo(ownedVideos[i], lastPaidWeek + j);

                    amountToPay += 
                        BitBlockLibrary.PERCENT_OF_REVENUE_TO_CREATORS 
                        * thisContractBalanceWeeklySnapshot[lastPaidWeek + j] 
                        / (weeklyViewsMultiple * 100);
                }
            }
        }
        if (amountToPay > 0) {
            safeTransferFrom(address(this), msg.sender, BitBlockLibrary.FUNGIBLE_TOKEN_ID, amountToPay, "");
            bitBlockUsers.setCreatorLastPaidWeek(msg.sender, currentWeek);
        }
    }


    //Functions related to Videos

    function createVideo(string memory newVideoCID) external returns(uint256) {
        require(bitBlockUsers.userHasMinimumStaked(msg.sender, currentWeek), "Creator does not have enough staked");

        uint256 tokenId = bitBlockVideos.addNewVideo(newVideoCID, msg.sender);
        _mint(tx.origin, tokenId, 1, "");

        bitBlockUsers.addNewVideo(tokenId, msg.sender);
        
        return tokenId;
    }

    function getAllVideos() external view returns(BitBlockVideos.Video[] memory) {
        return bitBlockVideos.getAllVideos();
    }

    function getVideosByCreator(address creatorAddress) external view returns(BitBlockVideos.Video[] memory) {
        uint256[] memory videoIndicesOfCreator = bitBlockUsers.getVideoIndicesOfCreator(creatorAddress);
	    return bitBlockVideos.getVideosByOwner(videoIndicesOfCreator);
    }

    function getRecommendedVideos(uint8 desiredPromotedPerTen) external returns(BitBlockVideos.Video[] memory) {
        int256 remainingWeeklyPromotedViews = (int256)(
            bitBlockUsers.getAmountStakedOfWeek(msg.sender, currentWeek) 
                / BitBlockLibrary.STAKE_AMOUNT_PER_ALLOWED_PROMOTED_VIEW
            ) - (int16)(bitBlockUsers.getPromotedViewCountOfWeek(msg.sender, currentWeek));
        
        if (remainingWeeklyPromotedViews < 0) { // could be the case if user decreased stake mid-week
            remainingWeeklyPromotedViews = 0;
        }
        if (desiredPromotedPerTen < uint256(remainingWeeklyPromotedViews)) {
            desiredPromotedPerTen = uint8(uint256(remainingWeeklyPromotedViews));
        }
        require(desiredPromotedPerTen < 5);

        bool viewerHasMinimumStaked = bitBlockUsers.userHasMinimumStaked(msg.sender, currentWeek);
        if (viewerHasMinimumStaked) {
            bitBlockUsers.addToPromotedViewCountForWeek(msg.sender, currentWeek, desiredPromotedPerTen);
        }


        return bitBlockVideos.getRecommendedVideos(
            viewerHasMinimumStaked,
            desiredPromotedPerTen, 
            currentWeek
        );
    }

    function updateWeekly() external {
        uint32 oneWeekInSeconds = 86400 * 7; // 604,800 is how many seconds in a week
        uint32 secondsSinceLastWeek = uint32(block.timestamp - lastWeekResetTime);

        if (secondsSinceLastWeek > oneWeekInSeconds) {
            thisContractBalanceWeeklySnapshot[currentWeek] = balanceOf(address(this), BitBlockLibrary.FUNGIBLE_TOKEN_ID);
            lastWeekResetTime += uint32(secondsSinceLastWeek / oneWeekInSeconds);
            currentWeek += 1;
        }
    }


    // Functions related to Likes/Dislikes

    function likeVideo(uint256 tokenId) external {
        bitBlockVideos.likeVideo(tokenId);

    }

    function dislikeVideo(uint256 tokenId) external {
        bitBlockVideos.dislikeVideo(tokenId);
    }


    // Functions related to Comments

    function addComment(uint256 tokenId, string memory newMessage) external {
        bitBlockVideos.addComment(tokenId, newMessage, msg.sender);
    }

    function likeComment(uint256 tokenId, uint16 commentIndex) external {
        bitBlockVideos.likeComment(tokenId, commentIndex);
    }


    // Functions related to reports

    function reportVideo(uint256 tokenId, string memory reportMessage, string memory reportType) external {
        bitBlockVideos.reportVideo(tokenId, reportMessage, reportType, msg.sender);
    }
}

contract BitBlockUsers {
    mapping(address => UserInfo) public userInfoMap;
    mapping(uint16 => uint256) public globalAmountStakedWeeklySnapshot;

    struct StakeEvent {
        uint256 amountStaked;
        uint256 timestamp;
    }

    struct UserInfo {
        uint256[] ownedVideos;
        StakeEvent[] stakeEvents;
        mapping(uint16 => uint256) amountStakedWeeklySnapshot;
        mapping(uint16 => uint16) weeklyPromotedViewCount;
        uint16 lastPaidViewWeek;
        uint16 lastPaidCreatorWeek;
    }

    function getVideoIndicesOfCreator(address creatorAddress) public view returns(uint256[] memory){
        return userInfoMap[creatorAddress].ownedVideos;
    }


    function userHasMinimumStaked(address userAddress, uint16 currentWeek) public view returns(bool) {
        return userInfoMap[userAddress].amountStakedWeeklySnapshot[currentWeek] >= (5 * (10 ** BitBlockLibrary.DECIMALS));
    }


    function getPromotedViewCountOfWeek(address viewerAddress, uint16 week) public view returns(uint16) {
        return userInfoMap[viewerAddress].weeklyPromotedViewCount[week];
    }

    function addToPromotedViewCountForWeek(address viewerAddress, uint16 currentWeek, uint8 numPromotedPerTen) public {
        userInfoMap[viewerAddress].weeklyPromotedViewCount[currentWeek] += numPromotedPerTen;
    }

    
    function getViewerLastPaidWeek(address viewerAddress) public view returns(uint16){
        return userInfoMap[viewerAddress].lastPaidViewWeek;
    }

    function setViewerLastPaidWeek(address viewerAddress, uint16 currentWeek) public {
        userInfoMap[viewerAddress].lastPaidViewWeek = currentWeek;
    }


    function getOwnedVideosOfCreator(address creatorAddress) public view returns(uint256[] memory) {
        return userInfoMap[creatorAddress].ownedVideos;
    }


    function getCreatorLastPaidWeek(address creatorAddress) public view returns(uint16) {
        return userInfoMap[creatorAddress].lastPaidCreatorWeek;
    }

    function setCreatorLastPaidWeek(address viewerAddress, uint16 currentWeek) public {
        userInfoMap[viewerAddress].lastPaidCreatorWeek = currentWeek;
    }
    
    function addNewVideo(uint256 tokenId, address creatorAddress) public {
        userInfoMap[creatorAddress].ownedVideos.push(tokenId);
    }

    function getAmountStakedOfWeek(address userAddress, uint16 week) public view returns(uint256) {
        return userInfoMap[userAddress].amountStakedWeeklySnapshot[week];
    }

    function stake(address userAddress, uint256 amount, uint16 currentWeek) public {
        UserInfo storage userInfo = userInfoMap[userAddress];
        StakeEvent memory stakeEvent = StakeEvent({
            amountStaked: amount,
            timestamp: block.timestamp
        });
        userInfo.stakeEvents.push(stakeEvent);
        userInfo.amountStakedWeeklySnapshot[currentWeek] += amount;
        globalAmountStakedWeeklySnapshot[currentWeek] += amount;
    }

    function unstake(address userAddress, uint256 amount, uint16 currentWeek) public {
        UserInfo storage userInfo = userInfoMap[userAddress];
        uint256 amountFreeToUnstake = 0;
        StakeEvent[] memory stakeEvents = userInfo.stakeEvents;
        for (uint i = 0; i < stakeEvents.length; i++) {
            StakeEvent memory stakeEvent = stakeEvents[i];
            if (stakeEvent.timestamp < block.timestamp - (86400 * 7)) { // one week lockup period
                amountFreeToUnstake += stakeEvent.amountStaked;
            } else {
                break; // can skip rest since should be in array in order of timestamp,
            }
        }
        require(amountFreeToUnstake >= amount);

        userInfo.amountStakedWeeklySnapshot[currentWeek] -= amount;
        globalAmountStakedWeeklySnapshot[currentWeek] -= amount;
    }
}

contract BitBlockVideos {
    struct Video { //maybe want to add tokenId field?
        string videoCID;
        address owner;

        // should (or could eventually) make these weekly mappings too for better recommendations
        uint32 likeCount;
        uint32 dislikeCount;

        uint32 totalViewCount;
        uint32 numPromotedViews;
        BitBlockComment[] comments;
        BitBlockReport[] reports;
    }

    uint256 public videosSize;
    mapping(uint256 => Video) private _videos; // mapping from tokenID to Video
    mapping(uint256 => mapping(uint16 => uint32)) private videosWeeklyViewCount; //mapping from tokenID to mapping from week to view count
    StructuredLinkedList.List private _sortedVideosList; // TODO: (I think this is done?): Append videos on upload, Sort videos after like/dislike action (or per day)
    StructuredLinkedList.List private _promotedVideos;

    mapping(uint16 => uint32) public weeklyGlobalViewCount;
    mapping(uint16 => uint32) public weeklyGlobalPromotedViewCount;

    RandHelper private randHelper;

    constructor() {
        randHelper = new RandHelper();
    }

    function addNewVideo(string memory newVideoCID, address creatorAddress) public returns(uint256){
        Video storage newVideo = _videos[++videosSize];
        newVideo.videoCID = newVideoCID;
        newVideo.owner = creatorAddress;

        StructuredLinkedList.pushBack(_sortedVideosList, videosSize);

        return videosSize;
    }

    function getAllVideos() public view returns(Video[] memory) {
        Video[] memory allVideos = new Video[](videosSize);
        for (uint i = 0; i < videosSize; i++) {
            allVideos[i] = _videos[i];
        }
        return allVideos;
    }

    function getVideosByOwner(uint256[] calldata videoIndicesOfOwner) public view returns(Video[] memory) {
        uint numOwnedVideos = videoIndicesOfOwner.length;
        Video[] memory ownerVideos = new Video[](numOwnedVideos);
        for (uint i = 0; i < numOwnedVideos; i++) {
		    ownerVideos[i] = _videos[videoIndicesOfOwner[i]];
	    }
	    return ownerVideos;
    }

    function getRecommendedVideos(
        bool viewerHasMinimumStake,
        uint8 numPromotedPerTen,
        uint16 currentWeek
    ) public returns (Video[] memory){
        uint8 numVideos = 10;
        if (videosSize < 10) {
            numVideos = uint8(videosSize);
        }
        if (_promotedVideos.size < numPromotedPerTen) {
            numPromotedPerTen = uint8(_promotedVideos.size);
        }

        Video[] memory recommendedVideos = new Video[](numVideos);
        uint8 numNormalPerTen = numVideos - numPromotedPerTen;

        // Add normal videos to response
        weeklyGlobalViewCount[currentWeek] += numNormalPerTen;
        for (uint8 i = 0; i < numNormalPerTen; i++) {
            uint256 videoIndex = randHelper.pseudoWeightedRandomVideoIndex(videosSize);
            recommendedVideos[i] = _videos[getLinkedListNodeByIndex(_sortedVideosList, videoIndex)];
            if (viewerHasMinimumStake) {
                ++recommendedVideos[i].totalViewCount;
                ++videosWeeklyViewCount[videoIndex][currentWeek];
            }
        }

        //Add promoted videos to response
        for (uint8 i = numNormalPerTen; i < numVideos; i++) {
            uint256 videoIndex = randHelper.pseudoRandom(videosSize) % StructuredLinkedList.sizeOf(_promotedVideos);
            recommendedVideos[i] = _videos[getLinkedListNodeByIndex(_promotedVideos, videoIndex)];
            if (viewerHasMinimumStake) {
                ++recommendedVideos[i].totalViewCount;
                ++videosWeeklyViewCount[videoIndex][currentWeek];
                recommendedVideos[i].numPromotedViews--;
            }
        }

        if (viewerHasMinimumStake) {
            weeklyGlobalPromotedViewCount[currentWeek] += numPromotedPerTen;
        }
        return recommendedVideos;
    }

    function increaseNumPromotedViews(uint256 tokenId, uint32 numToIncrease) public {
        StructuredLinkedList.pushBack(_promotedVideos, tokenId); // will return false if already exists
        _videos[tokenId].numPromotedViews += numToIncrease;
    }

    function getWeeklyViewCountOfVideo(uint256 tokenId, uint16 currentWeek) public view returns(uint32) {
        return videosWeeklyViewCount[tokenId][currentWeek];
    }

    function getLinkedListNodeByIndex(StructuredLinkedList.List storage list, uint256 index) private returns(uint256) {
        uint256 node = StructuredLinkedList.popFront(list); // TODO: there must be a better way (so that can make it a "view" function
        assert(StructuredLinkedList.pushFront(list, node));
        for (uint i = 0; i < index; i++) {
            (, node) = StructuredLinkedList.getNextNode(list, node);
        }
        return node;
    }

    function transferOwnership(uint256 tokenId, address newOwner) public {
        _videos[tokenId].owner = newOwner;
    }

    // Functions related to Likes/Dislikes

    function getScore(uint tokenId) private view returns(uint32) {
        return _videos[tokenId].likeCount - _videos[tokenId].dislikeCount;  // TODO make better
    }

    function likeVideo(uint256 tokenId) public {
        _videos[tokenId].likeCount++;
        updateListPosition(tokenId);
    }

    function dislikeVideo(uint256 tokenId) public {
        _videos[tokenId].dislikeCount++;
        updateListPosition(tokenId);
    }

    function updateListPosition(uint256 tokenId) private {
        uint score = getScore(tokenId);

        (bool exists, uint256 left, uint256 right) = StructuredLinkedList.getNode(_sortedVideosList, tokenId);

        if (exists) {
            if (score > getScore(left)) { // if needs to move up in rank
                while (score > getScore(left)) {
                    (exists, left) = StructuredLinkedList.getPreviousNode(_sortedVideosList, left);
                }
                StructuredLinkedList.insertAfter(_sortedVideosList, left, StructuredLinkedList.remove(_sortedVideosList, tokenId));
            } else if (score < getScore(right)) { // if needs to move down in rank
                while (score < getScore(right)) {
                    (exists, right) = StructuredLinkedList.getNextNode(_sortedVideosList, right);
                }
                StructuredLinkedList.insertBefore(_sortedVideosList, right, StructuredLinkedList.remove(_sortedVideosList, tokenId));
            }
        }
    }

    function addComment(uint256 tokenId, string memory newMessage, address commenter) public {
        BitBlockComment newComment = new BitBlockComment(newMessage, commenter);
        _videos[tokenId].comments.push(newComment);
    }

    function likeComment(uint256 tokenId, uint16 commentIndex) public {
        _videos[tokenId].comments[commentIndex].likeComment();
    }

    function reportVideo(uint256 tokenId, string memory reportMessage, string memory reportType, address commenter) public {
        BitBlockReport newReport = new BitBlockReport(reportMessage, reportType, commenter);
        _videos[tokenId].reports.push(newReport);
    }
}

contract BitBlockComment {
    string public message;
    uint32 public likeCount;
    uint32 public dislikeCount;
    uint32 public timestamp;
    address public commenter;

    constructor(string memory newMessage, address newCommenter) {
        message = newMessage;
        commenter = newCommenter;
        timestamp = uint32(block.timestamp);
    }

    function likeComment() external {
        ++likeCount;
    }

    function dislikeComment() external {
        ++dislikeCount;
    }
}

contract BitBlockReport {
    string reportMessage;
    ReportType reportType;
    address reporter;
    uint32 timestamp;

    enum ReportType { Scam, ExcessiveViolence, HateSpeech, MinorSafety }

    constructor(string memory newReportMessage, string memory newReportTypeStr, address userAddress) {
        ReportType newReportType;
        bytes32 hashedReportTypeStr = keccak256(abi.encodePacked(newReportTypeStr));

        //TODO maybe cheaper to store hashed ReportTypes to avoid hashing each time.
        if (keccak256(abi.encodePacked("Scam")) == hashedReportTypeStr) {
            newReportType = ReportType.Scam;
        } else if (keccak256(abi.encodePacked("ExcessiveViolence")) == hashedReportTypeStr) {
            newReportType = ReportType.ExcessiveViolence;
        } else if (keccak256(abi.encodePacked("HateSpeech")) == hashedReportTypeStr) {
            newReportType = ReportType.HateSpeech;
        } else if (keccak256(abi.encodePacked("MinorSafety")) == hashedReportTypeStr) {
            newReportType = ReportType.MinorSafety;
        } else {
            revert("ReportType invalid. Valid types: Scam, ExcessiveViolence, HateSpeech, and MinorSafety");
        }

        reportMessage = newReportMessage;
        reportType = newReportType;
        reporter = userAddress;
        timestamp = uint32(block.timestamp);
    }
}

contract RandHelper {

    uint256 private _randValHelper;

    constructor() {
        _randValHelper = 0;
    }

    // Creates pseudo random number
    // RandValHelper allows different random values during same block
    // Fine that it can theoretically be calculated ahead of time, just needed for some varied video selection
    function pseudoRandom(uint videosSize) public returns(uint) {
        return uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp, videosSize, _randValHelper++)));
    }

    // Discovered this on my own, I'm a fucking genius 
    // lastNumber ex:
    // 10, 19, 27, 34, 40, 45, 49, 52, 54, 55
    // ((10 * 10) + 10) / 2 == 55
    function pseudoWeightedRandomVideoIndex(uint videosSize) public returns(uint) {
        uint lastNumber = ((videosSize ** 2) + videosSize) / 2;
        uint weightedRandomIndex = pseudoRandom(videosSize) % lastNumber;

        for (uint i = 0; i < videosSize; i++) {
            if (weightedRandomIndex < (videosSize - i)) {
                return i;
            }
            weightedRandomIndex -= (videosSize - i);
        }
        return 0; // This should theoretically never execute
    }
}