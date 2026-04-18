CREATE DATABASE  IF NOT EXISTS `sims_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `sims_db`;
-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: sims_db
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `account_requests`
--

DROP TABLE IF EXISTS `account_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_type` varchar(50) DEFAULT 'account_creation',
  `requested_by_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `requested_role` varchar(50) NOT NULL,
  `requested_department_id` int DEFAULT NULL,
  `approval_status` varchar(50) DEFAULT 'pending_admin',
  `requested_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `dept_head_approved_date` timestamp NULL DEFAULT NULL,
  `dept_head_approved_by_id` int DEFAULT NULL,
  `admin_approved_date` timestamp NULL DEFAULT NULL,
  `admin_approved_by_id` int DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `rejection_date` timestamp NULL DEFAULT NULL,
  `request_reason` varchar(500) DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_requests`
--

LOCK TABLES `account_requests` WRITE;
/*!40000 ALTER TABLE `account_requests` DISABLE KEYS */;
INSERT INTO `account_requests` VALUES (1,'deactivation','HOD Check','hodcheck@example.com','staff',2,'pending_admin','2026-04-18 13:28:18',NULL,NULL,NULL,NULL,NULL,NULL,'Requested from profile page',1,'2026-04-18 13:28:18','2026-04-18 13:28:18');
/*!40000 ALTER TABLE `account_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `department_id` int NOT NULL AUTO_INCREMENT,
  `department_name` varchar(100) NOT NULL,
  `dept_code` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`department_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'Dean Office','DO'),(2,'Information Technology','IT'),(3,'Computational Mathematics','CM'),(4,'Interdisciplinary Studies','IDS'),(5,'Undergraduate Studies','UGS'),(6,'Postgraduate Studies','PGS'),(7,'Information Technology Research Unit','ITRU');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `designations`
--

DROP TABLE IF EXISTS `designations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `designations` (
  `designation_id` int NOT NULL AUTO_INCREMENT,
  `designation` varchar(100) DEFAULT NULL,
  `designation_code` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`designation_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `designations`
--

LOCK TABLES `designations` WRITE;
/*!40000 ALTER TABLE `designations` DISABLE KEYS */;
INSERT INTO `designations` VALUES (1,'Lecturer','Lec'),(2,'Instructor','Ins'),(3,'Technical Officer','TO'),(4,'Management Assistant','MA'),(5,'Laboratory Attendant','LA'),(6,'Works Aide','WA'),(7,'Other','Other');
/*!40000 ALTER TABLE `designations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventories`
--

DROP TABLE IF EXISTS `inventories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventories` (
  `inventory_id` int NOT NULL AUTO_INCREMENT,
  `inventory_name` varchar(100) NOT NULL,
  `location` varchar(200) DEFAULT NULL,
  `department_id` int NOT NULL,
  `incharge_user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `hod_user_id` int DEFAULT NULL,
  PRIMARY KEY (`inventory_id`),
  KEY `department_id` (`department_id`),
  KEY `incharge_user_id` (`incharge_user_id`),
  KEY `fk_hod` (`hod_user_id`),
  CONSTRAINT `fk_hod` FOREIGN KEY (`hod_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `inventories_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `inventories_ibfk_2` FOREIGN KEY (`incharge_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventories`
--

LOCK TABLES `inventories` WRITE;
/*!40000 ALTER TABLE `inventories` DISABLE KEYS */;
INSERT INTO `inventories` VALUES (1,'CL3/PIB01','Lab 03',2,1,'2026-04-18 12:30:51',5),(2,'CL2/PIB01','Lab 02',2,2,'2026-04-18 13:11:27',5);
/*!40000 ALTER TABLE `inventories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_creation_requests`
--

DROP TABLE IF EXISTS `inventory_creation_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_creation_requests` (
  `inv_req_id` int NOT NULL AUTO_INCREMENT,
  `req_user_name` varchar(255) NOT NULL,
  `department_id` int NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `requested_by_id` int NOT NULL,
  `requested_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` text,
  `approval_status` enum('pending_staff','approved_by_hod','pending_registrar','approved_by_registrar','rejected') DEFAULT 'pending_staff',
  `hod_approved_date` timestamp NULL DEFAULT NULL,
  `hod_approved_by_id` int DEFAULT NULL,
  `registrar_approved_date` timestamp NULL DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `rejection_date` timestamp NULL DEFAULT NULL,
  `created_inventory_id` int DEFAULT NULL,
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`inv_req_id`),
  KEY `department_id` (`department_id`),
  KEY `requested_by_id` (`requested_by_id`),
  KEY `hod_approved_by_id` (`hod_approved_by_id`),
  KEY `created_inventory_id` (`created_inventory_id`),
  CONSTRAINT `inventory_creation_requests_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `inventory_creation_requests_ibfk_2` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `inventory_creation_requests_ibfk_3` FOREIGN KEY (`hod_approved_by_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `inventory_creation_requests_ibfk_4` FOREIGN KEY (`created_inventory_id`) REFERENCES `inventories` (`inventory_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_creation_requests`
--

LOCK TABLES `inventory_creation_requests` WRITE;
/*!40000 ALTER TABLE `inventory_creation_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_creation_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_items`
--

DROP TABLE IF EXISTS `inventory_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_items` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `inventory_id` int NOT NULL,
  `item_name` varchar(150) NOT NULL,
  `item_code` varchar(25) NOT NULL,
  `serial_no` varchar(100) DEFAULT NULL,
  `serial_no2` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `value` int DEFAULT NULL,
  `qr_code` varchar(255) DEFAULT NULL,
  `qr_code2` varchar(255) DEFAULT NULL,
  `purchased_date` date DEFAULT NULL,
  `po_no` int DEFAULT NULL,
  `gin_no` int DEFAULT NULL,
  `gin_pdf` varchar(255) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `supplier` varchar(100) DEFAULT NULL,
  `warranty` varchar(50) DEFAULT NULL,
  `funding_source` varchar(100) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `remarks` text,
  `status` enum('available','issued','repair','disposed') DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `inventory_id` (`inventory_id`),
  CONSTRAINT `inventory_items_ibfk_1` FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`inventory_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_items`
--

LOCK TABLES `inventory_items` WRITE;
/*!40000 ALTER TABLE `inventory_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `user_role` varchar(50) NOT NULL,
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,'Staff Member'),(2,'Dean'),(3,'Head of the Department'),(4,'Registrar'),(5,'Admin'),(6,'Inventory InCharge');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `mobile_no` int DEFAULT NULL,
  `off_ext` int DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `designation_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  KEY `fk_users` (`department_id`),
  KEY `fk_desg` (`designation_id`),
  CONSTRAINT `fk_desg` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`designation_id`),
  CONSTRAINT `fk_users` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `user_roles` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'R. Dulakshi Wageeshani','dulakshiw@uom.lk','dulakshi123',772273403,8165,1,3,2,'Active','2026-04-10 07:02:49','2026-04-18 13:17:35'),(2,'M.D. Charitha Abeynayake','charithana@uom.lk','charitha123',777908752,8163,1,3,2,'Active','2026-04-10 07:07:58',NULL),(3,'R. Dulakshi Wageeshani','wageeshanird@gmail.com','dulakshi123',772273403,8165,5,NULL,2,'Active','2026-04-10 07:11:50','2026-04-18 12:52:09'),(4,'B.H. Sudantha','sudanthabh@uom.lk','sudantha123',715721744,8001,1,1,2,'Active','2026-04-10 08:17:01',NULL),(5,'G.T. Indika Karunarathne','indikak@uom.lk','indika123',NULL,8101,3,1,2,'Active','2026-04-18 07:08:55','2026-04-18 07:56:23');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'sims_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-18 22:14:37
