-- CreateTable
CREATE TABLE "GroupRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostKey" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "deadlineAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "orderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL,
    "memberKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GroupRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "optionIds" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "optionLabels" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GroupRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_roomId_memberKey_key" ON "GroupMember"("roomId", "memberKey");

-- CreateIndex
CREATE INDEX "GroupItem_roomId_idx" ON "GroupItem"("roomId");
