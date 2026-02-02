// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DustAggregator
 * @dev EIP-7702 compliant contract for aggregating dust from multiple chains
 */
contract DustAggregator {
    address public owner;
    address public feeAddress;
    uint256 public constant FEE_PERCENTAGE = 500; // 5% in basis points
    
    event DustAggregated(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );
    
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    event FeeAddressUpdated(
        address indexed oldFeeAddress,
        address indexed newFeeAddress
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor(address _feeAddress) {
        require(_feeAddress != address(0), "Invalid fee address");
        owner = msg.sender;
        feeAddress = _feeAddress;
    }
    
    /**
     * @dev Receive dust and forward to destination with fee deduction
     * @param to Destination address
     */
    function aggregateDust(address payable to) external payable {
        require(to != address(0), "Invalid destination address");
        require(msg.value > 0, "No dust to aggregate");
        
        // Calculate fee
        uint256 fee = (msg.value * FEE_PERCENTAGE) / 10000;
        uint256 amountAfterFee = msg.value - fee;
        
        // Send fee to fee address
        if (fee > 0) {
            (bool feeSuccess, ) = payable(feeAddress).call{value: fee}("");
            require(feeSuccess, "Failed to send fee");
        }
        
        // Send remaining amount to destination
        (bool success, ) = to.call{value: amountAfterFee}("");
        require(success, "Failed to send dust");
        
        emit DustAggregated(msg.sender, to, amountAfterFee, fee, block.timestamp);
    }
    
    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Update fee address
     * @param newFeeAddress New fee address
     */
    function updateFeeAddress(address newFeeAddress) external onlyOwner {
        require(newFeeAddress != address(0), "Invalid fee address");
        address oldFeeAddress = feeAddress;
        feeAddress = newFeeAddress;
        emit FeeAddressUpdated(oldFeeAddress, newFeeAddress);
    }
    
    /**
     * @dev Emergency withdraw
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    /**
     * @dev Get contract info
     */
    function getContractInfo() external view returns (
        address _owner,
        address _feeAddress,
        uint256 _feePercentage,
        uint256 _balance
    ) {
        return (
            owner,
            feeAddress,
            FEE_PERCENTAGE,
            address(this).balance
        );
    }
    
    receive() external payable {
        aggregateDust(payable(msg.sender));
    }
    
    fallback() external payable {
        aggregateDust(payable(msg.sender));
    }
}
