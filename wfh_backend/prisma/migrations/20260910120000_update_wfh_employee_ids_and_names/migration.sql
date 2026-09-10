-- Update reg_users with WFH1, WFH2 format and updated Indian names (preserving RIYA KUMARI)
UPDATE "reg_users" SET "employeeId" = 'WFH1', "name" = 'Aarav Sharma' WHERE "id" = 1;
UPDATE "reg_users" SET "employeeId" = 'WFH2', "name" = 'Priya Verma' WHERE "id" = 2;
UPDATE "reg_users" SET "employeeId" = 'WFH3', "name" = 'Rohan Patel' WHERE "id" = 3;
UPDATE "reg_users" SET "employeeId" = 'WFH4', "name" = 'Ananya Gupta' WHERE "id" = 4;
UPDATE "reg_users" SET "employeeId" = 'WFH5', "name" = 'Aditya Singh' WHERE "id" = 5;
UPDATE "reg_users" SET "employeeId" = 'WFH6', "name" = 'Neha Sharma' WHERE "id" = 6;
UPDATE "reg_users" SET "employeeId" = 'WFH7', "name" = 'Kavya Nair' WHERE "id" = 7;
UPDATE "reg_users" SET "employeeId" = 'WFH8', "name" = 'Siddharth Joshi' WHERE "id" = 8;
UPDATE "reg_users" SET "employeeId" = 'WFH9', "name" = 'Pooja Iyer' WHERE "id" = 9;
UPDATE "reg_users" SET "employeeId" = 'WFH10', "name" = 'Vikram Malhotra' WHERE "id" = 10;
UPDATE "reg_users" SET "employeeId" = 'WFH11', "name" = 'Sneha Reddy' WHERE "id" = 11;
UPDATE "reg_users" SET "employeeId" = 'WFH12', "name" = 'Amitabh Roy' WHERE "id" = 12;
UPDATE "reg_users" SET "employeeId" = 'WFH13', "name" = 'Meera Pillai' WHERE "id" = 13;
UPDATE "reg_users" SET "employeeId" = 'WFH14', "name" = 'Aryan Sonar' WHERE "id" = 14;
UPDATE "reg_users" SET "employeeId" = 'WFH15', "name" = 'Rishikesh Kulkarni' WHERE "id" = 15;
UPDATE "reg_users" SET "employeeId" = 'WFH16', "name" = 'Niyati Wadekar' WHERE "id" = 16;
UPDATE "reg_users" SET "employeeId" = 'WFH17', "name" = 'Shivshankar Sawant' WHERE "id" = 17;
UPDATE "reg_users" SET "employeeId" = 'WFH18', "name" = 'Rohit Kadam' WHERE "id" = 18;
UPDATE "reg_users" SET "employeeId" = 'WFH19', "name" = 'Varun Rao' WHERE "id" = 19;
UPDATE "reg_users" SET "employeeId" = 'WFH20', "name" = 'Avantika Bhadke' WHERE "id" = 20;
UPDATE "reg_users" SET "employeeId" = 'WFH21', "name" = 'Vineet Pingale' WHERE "id" = 21;
UPDATE "reg_users" SET "employeeId" = 'WFH22', "name" = 'RIYA KUMARI' WHERE "id" = 22;
UPDATE "reg_users" SET "employeeId" = 'WFH23', "name" = 'Deepali Mudgal' WHERE "id" = 23;
UPDATE "reg_users" SET "employeeId" = 'WFH24', "name" = 'Rutuja Shitole' WHERE "id" = 24;
UPDATE "reg_users" SET "employeeId" = 'WFH25', "name" = 'Dipti Waghmare' WHERE "id" = 25;
UPDATE "reg_users" SET "employeeId" = 'WFH26', "name" = 'Madhav More' WHERE "id" = 26;
UPDATE "reg_users" SET "employeeId" = 'WFH27', "name" = 'Sakshi Suralkar' WHERE "id" = 27;
UPDATE "reg_users" SET "employeeId" = 'WFH28', "name" = 'Krunal Jayale' WHERE "id" = 28;
UPDATE "reg_users" SET "employeeId" = 'WFH29', "name" = 'Ankita Gholap' WHERE "id" = 29;
UPDATE "reg_users" SET "employeeId" = 'WFH30', "name" = 'Arjun Mehta' WHERE "id" = 30;
UPDATE "reg_users" SET "employeeId" = 'WFH31', "name" = 'Harshada More' WHERE "id" = 31;
UPDATE "reg_users" SET "employeeId" = 'WFH32', "name" = 'Namrata Gaonkar' WHERE "id" = 32;
UPDATE "reg_users" SET "employeeId" = 'WFH33', "name" = 'Pranjal Rankhambe' WHERE "id" = 33;
UPDATE "reg_users" SET "employeeId" = 'WFH34', "name" = 'Tanaya Gaikwad' WHERE "id" = 34;
UPDATE "reg_users" SET "employeeId" = 'WFH35', "name" = 'Nikita Devkar' WHERE "id" = 35;
UPDATE "reg_users" SET "employeeId" = 'WFH36', "name" = 'Rajeshwari Shinde' WHERE "id" = 36;

-- Sync shift table employeeId with the updated user employeeId
UPDATE "Shift" s
SET "employeeId" = u."employeeId"
FROM "reg_users" u
WHERE s."userId" = u."id";
