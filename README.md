<div style="display: flex; justify-content: center;">
<img src="https://cdn.postnl.nl/images/icons/svg/logo-postnl-outline.svg" alt="logo_postnl" width="1000" />
</div>

<h1 style="text-align: center;">Event Management Platform - EMP PostNL Assignment</h1>

<h2 style="text-align: center;">AWS Serverless: API GateWay, Lambda, EventBridge, DynamodDB, SNS, SQS, CloudWatch & X-Ray </h2>


This assignment demonstrates an **AWS serverless architecture** built using **AWS CDK** and **TypeScript**. It leverages AWS services such as **Lambda, API Gateway, DynamoDB, EventBridge, SQS, SNS, CloudWatch and X-Ray** to provide a PoC (proof of concept) but also, a robust, scalabe , serverless solution designed to ensure the reliability and integrity of (parcel) logistics operations. This project leverages a modern, AWS-based architecture to continuously monitor and manage execution events across a logistic systems. In addition, **load testing with Artillery** was performed to ensure that the **infrastructure** can **handle real-world traffic efficiently**(observing by AWS free tier limits) while maintaining stability.  


---
## Table of Content


1. [Project Name and Introduction](#project-name-and-introduction)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Stack](#stack)
5. [Requirements](#requirements)
6. [Recommended Modules](#recommended-modules)
7. [Installation](#installation)
8. [API Documentation](#api-documentation)
9. [Potential Improvements](#potential-improvements)
10. [Questions](#questions)
11. [Stay in Touch](#stay-in-touch)
12. [License](#license)

Design Decisions Why Cognito instead of Auth 

---
### 2. Architecture / Infrastructure

The image below illustrates the suggested EMP Event Management Platform AWS Acrhitecture for an IT Logistic Platform: 

<div style="display: flex; justify-content: center;">
<img src="/pics/EMP_and_PostNL_IT_Logistic_Plat.png" alt="EMP PostNL suggested AWS Architecture" width="1200" />
</div>

This PoC demonstrates that EMP serves as the centralized hub that:

**Monitors Real-Time Events**: Captures every event from different sources, ensuring that issues such as delays or errors are immediately detected.

**Automates Workflows**: Utilizes AWS services like EventBridge, SNS, SQS, and Lambda to trigger automated responses, keeping the entire process in sync.

**Enhances Resilience**: Quickly identifies discrepancies in the logistics chain, enabling rapid intervention to maintain smooth operations.

Below, for illustration, an IT Logistic Platform without the suggested EMP central role:

<div style="display: flex; justify-content: center;">
<img src="/pics/PostNL_IT_Logistic_Plat.png" alt="PostNL suggested AWS Architecture" width="1200" />
</div>
---

---

### 3. Features

**3.1 Automated Monitoring:** Continuously checks execution plans to detect missing or incomplete events.

**3.2 Real-Time Alerts:** Uses Amazon SNS to promptly notify the team of any operational discrepancies.

**3.3 Error Handling:** Implements a Dead Letter Queue via Amazon SQS to capture and process failed events.

**3.4 Data Integrity:** Manages state and execution data efficiently using Amazon DynamoDB.

**3.5 Scalability & Efficiency:** Built with serverless architecture and AWS SDK v3 for modular, lightweight integration.

**3.6 Observability & Logging**

- **Amazon CloudWatch Logs** for monitoring API and Lambda execution.
- **Amazon X-Ray** for end-to-end tracing.
- **API Gateway access logs** with structured JSON format.

**3.7 Scalability & Performance**

- **DynamoDB Auto Scaling** (commented out but ready to enable).
- **Lambda function concurrency provisioning** for performance tuning.
- **API Gateway Usage Plan** with rate limits:
    - **400 requests per second**
    - **800 burst limit**
    - **1,000,000 monthly quota**

**3.8 Load Testing with Artillery**
**Performance benchmarking** using Artillery for load testing.
- Simulates user traffic with **incremental load**:
    **Initial arrival rate**: 50 requets  per second.
    **Ramp-up**: Increases gradually to **100 requests per second** over 60 seconds.
- Targets a specific endpoint to evaluate **API scalability & responsiveness** under increasing traffic.
- Provides insights into **latency, throughput, and error rates** for optimizing system performance.


---

## 4. Stack

- Language: Node.js & TypeScript
- Framework: AWS CDK v3 (Infrastructure as Code)
- Observability : CloudWatch & X-Ray
- Real Time Notifications : SNS topics
- Decoupling Services: EventBridge & SQS queues
- Database: Amazon DynamodDB  (NoSQL, serverless, scalable)
- Authentication: Cognito JWT-based authentication
- Test : Artillery for load-test

---

## 5. Requirements

Before starting, ensure you have the following installed:


- [Node.js v20 or later](https://nodejs.org/)–required to run the project and install dependencies
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) –required to run the project and install dependencies
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) –required for authentication and deployment
- [npm](https://nodejs.org/en/learn/getting-started/an-introduction-to-the-npm-package-manager) –  for package management
- [TypeScript](https://www.npmjs.com/package/typescript)–if needed for local development
- [Artillery](https://www.artillery.io/)–required for load testing
---

## 6. Recommended Modules (optional)

While not mandatory, the following tools are recommended for smoother development and debugging:
- [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) for API testing

---

## 7. Installation


### Setup Instructions

### 7.1 Clone the repository

```bash
git clone https://github.com/myPortfolioAMS/EMP_PostNL_delivered 
cd EMP_PostNL_delivered 
```

### 7.2 Install Dependencies

Run the following command to install all required Node.js packages:
```bash
npm install 
```
### 7.3 Set up Permissions & Roles

- **7.3.1** Edit the "permission-setup.yaml" local file (application root folder) and replace <AWS_ACCOUNT_ID> with your own AWS Account Id.

- **7.3.2** In AWS Console, select CloudFormation, go to Stacks on the left hand side and then select "Create Stack" + "With new resources(standard)",on the right hand side upper corner.

- **7.3.3** Next step, first select "Choose an existing template", second select "Upload a template file", then third hit the "Choose file" button and select the local file named "permissions-setup.yaml".

- **7.3.4** Upload "permissions-setup.yaml and hit "Next" button.

- **7.3.5** Provide a stack name and hit the "Next" button one more time.

- **7.3.6** Hit the checkbox with the text "I acknowledge that AWS CloudFormation might create IAM resources with custom names."  and hit the "Next" button one last time.

- **7.3.7** Review and then hit the "Submit" button.

- **7.3.8** Wait for stack creation (Check in AWS Console under CloudFormation → Stacks).

### 7.4 Bootstrap the CDK

```sh
cdk bootstrap aws://<AWS_ACCOUNT_ID>/eu-central-1
```

### 7.5 Deploy

```sh
npm run deploy
```


---
## 8. API Documentation 


### 8.1 Register new user </br>

**POST** /register

Request Body:
```bash
{
  "email": "EMP@postnl.com",
  "password": "EMPpostnl_2502",
  "firstname": "Firstname",
  "lastname": "Lastname"

}
```

Response:

```bash
{
  "message": "User registered successfully",
  "userId": "83f4f872-30d1-70fb-be6e-280f25450684" 
}
```

**register live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/register](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/register) 

After a successful registration, a confirmation email is sent to the new user's email address. Before proceeding with login, the user must confirm his/her email address.

On production, for security reasons, "userId" must NOT be returned.As best practices, we only return necessary information. The idea is to minimize potential risks: if an attacker gains access to this enpoint, he/she will receive sensitive user details.

---
### 8.2 Login

**POST** /login

Request Body:
```bash
{
    "email": "EMP@postnl.com",
	"password": "EMPpostnl_2502"
}
```

Response:

```bash
{
  "token": "jwt_token"
}
```

**login live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/login](hhttps://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/login) 

---
### 8.3 COLLECTION endpoint(Secured)


**POST** /eventProducer
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
  "eventId": "27022025",
  "issuer": "WS001",
  "detailType": "ParcelEvent-COLLECTION",
  "zipcode_destination": "2521CA",
  "street_destination": "Waldorpstraat",
  "house_number_destination": "3",
  "city_of_destination": "Den Haag",
  "country_of_destination": "NL",
  "isPriority": false,
  "isInsured": false,
  "isRegistered": true,
  "isReRouting": false,
  "isReturning": false,
  "track_and_trace": "3S554433",
  "package_box_type": "type1",
  "parcel_weight": 2.5,
  "execution_status": "on time",
  "current_phase": "COLLECTION",
  "execution_plan": [
	{
  	"step": "COLLECTION",
  	"location": "1181 CR - Amstelveen",
  	"status": "completed",
  	"timestamp": "2025-02-25T08:30:00Z"
	}
  ],
  "dueDate": "2025-02-26T08:30:00Z",
  "timestamp": "2025-02-25T08:30:00Z"
}
```

**COLLECTION live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducer](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducer) 

---
### 8.4 FIRST SORTING endpoint(Secured)


**POST** /eventProducerFirstSorting
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
    "eventId": "25022025",
  "issuer": "SORT081",
  "detailType": "ParcelEvent-FIRST-SORTING",
  "execution_status": "on time",
  "current_phase": "FIRST_SORTING",
  "execution_plan": [
	{
  	"step": "FIRST_SORTING",
  	"location": "RONKIN_01",
  	"status": "complete",
  	"timestamp": "2025-02-25T10:09:00Z"
	}
  ],
  "dueDate": "2025-02-26T08:30:00Z",
  "timestamp": "2025-02-25T10:09:00Z"
}
```

**FIRST SORTING live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerFirstSorting](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerFirstSorting) 

---
### 8.5 CROSS DOCKING endpoint(Secured)


**POST** /eventProducerCrossDocking
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
    "eventId": "25022025",
  "issuer": "CD081",
  "detailType": "ParcelEvent-Cross-Docking",
  "execution_status": "on time",
  "current_phase": "CROSS_DOCKING",
  "execution_plan": [
	{
  	"step": "CROSS_DOCKING",
  	"location": "Hoofdrop",
  	"status": "complete",
  	"timestamp": "2025-02-25T14:55:00Z"
	}
  ],
  "dueDate": "2025-02-26T08:30:00Z",
  "timestamp": "2025-02-25T14:55:00Z"
}
```

**CROSS DOCKING live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerCrossDocking](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerCrossDocking) 

---
### 8.6 SECOND SORTING endpoint(Secured)


**POST** /eventProducerSecondSorting
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
    "eventId": "25022025",
  "issuer": "Leiden_1234",
  "detailType": "ParcelEvent-SECOND-SORTING",
  "execution_status": "on time",
  "current_phase": "SECOND_SORTING",
  "execution_plan": [
	{
  	"step": "SECOND_SORTING",
  	"location": "Leiden",
  	"status": "complete",
  	"timestamp": "2025-02-25T20:45:00Z"
	}
  ],
  "dueDate": "2025-02-26T08:30:00Z",
  "timestamp": "2025-02-25T20:45:00Z"
}
```

**SECOND SORTING live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerSecondSorting](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerSecondSorting) 

---
### 8.7 DISTRIBUTION endpoint(Secured)


**POST** /eventProducerDistribution
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
   "eventId": "25022025",
	"issuer": "DISTRI_9999",
	"detailType": "ParcelEvent-DISTRIBUTION",
	"execution_status": "on time",
	"current_phase": "DISTRIBUTION",
	"execution_plan": [
  	{
    	"step": "DISTRIBUTION",
    	"location": "Voorburg",
    	"status": "complete",
    	"timestamp": "2025-02-26T00:30:00Z"
  	}
	],
	"dueDate": "2025-02-26T08:30:00Z",
	"timestamp": "2025-02-26T00:30:00Z"
}
```

**DISTRIBUTION live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerDistribution](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerDistribution) 

---
### 8.8 FINAL DESTINATION endpoint(Secured)


**POST** /eventProducerFinalConsumer
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
   "eventId": "25022025",
  "issuer": "POSTNL-FINAL-DELIVERY-2025",
  "detailType": "ParcelEvent-FINAL-CONSUMER",
  "execution_status": "on time",
  "current_phase": "FINAL_DESTINATION",
  "execution_plan": [
	{
  	"step": "FINAL_DESTINATION",
  	"location": "2521 CA Den Haag",
  	"status": "complete",
  	"timestamp": "2025-02-26T07:55:00Z"
	}
  ],
  "dueDate": "2025-02-14T08:30:00Z",
  "timestamp": "2025-02-26T07:55:00Z"
}
```

**FINAL DESTINATION live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerFinalConsumer](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerFinalConsumer) 

---
### 8.9 FINAL DESTINATION endpoint(Secured) >>>>>>>>>>>>>>>>>>>>>>>>>>> **SPECIAL PAYLOAD TO TRIGGER REPLACEMENT OF THE EXECUTION PLAN**


**POST** /eventProducerFinalConsumer
please make sure to include the JWT token in the Authorization header.

Response:

```json
{
   "eventId": "25022025",
  "issuer": "POSTNL-FINAL-DELIVERY-2025",
  "detailType": "ParcelEvent-FINAL-CONSUMER",
  "execution_status": "on time",
  "current_phase": "FINAL_DESTINATION",
  "execution_plan": [
	{
  	"step": "FINAL_DESTINATION",
  	"location": "2521 CA Den Haag",
  	"status": "complete",
  	"timestamp": "2025-02-26T07:55:00Z"
	}
  ],
  "dueDate": "2025-02-14T08:30:00Z",
  "timestamp": "2025-02-26T07:55:00Z"
}
```

**FINAL DESTINATION live endpoint until 25/02/2025**: [https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerFinalConsumer](https://2obxofl1l7.execute-api.eu-central-1.amazonaws.com/prod/eventProducerFinalConsumer) 

---

### 8.10 Testing

**8.10.1** Use Postman or curl to test endpoints</br>
**8.10.2** Authenticate to obtain a JWT token before accessing secured endpoints.</br>
**8.10.3** find the load-test.yml file under the folder root-dir/test/load-test/</br>

---

### 9. Potential Improvements
If this project were to be production-ready, the following improvements would be considered:

The current stack is already built using highly available, managed AWS services, but it can optimize further for scalability and stability. Here are several recommendations( most of them beyond AWS Free Tier Limits):

**9.1 Lambda Functions (1000 concurrent executions unchangeable AWS default quota value in the free tier)**
    • Lambda functions inherently scale, but we can consider using Provisioned Concurrency for functions with latency-sensitive workloads or if we notice cold start issues during peak periods.
    • Define reserved concurrency limits to ensure one function doesn’t starve others during sudden traffic spikes.
    • Review and adjust batch sizes and retry settings on event source mappings (like SQS and DynamoDB triggers) to fine-tune processing under variable loads.

**9.2 DynamoDB**
    • The stack already uses auto scaling for provisioned tables— we need to make sure that minimum and maximum capacity settings reflect realistic traffic patterns.
    • For tables using PAY_PER_REQUEST, monitor costs and performance as traffic scales up.
    • Consider Global Tables or cross-region replication if multi-region high availability is a business requirement.

**9.3 API Gateway**
    • It has been enabled caching, throttling, and logging; we need to fine-tune and double-check that our throttling limits (rate and burst) match the expected peak loads.
    • Fine tune API Gateway usage plans to protect against traffic spikes and potential abuse.
    • Monitor API metrics (latency, error rates) and adjust cache TTLs based on the response characteristics.

**9.4 SQS & EventBridge**
    • Both services scale automatically; ensure that dead-letter queues are tuned to capture any processing failures without impacting throughput.
    • For SQS-triggered Lambdas, optimize the batch size and max batching window to balance throughput and latency.

**9.5 Monitoring and Observability**
    • Leverage CloudWatch and AWS X-Ray (already enabled) to monitor performance and error rates across services.
    • Set up additional alarms or dashboards to catch anomalies early, and use SNS notifications for prompt operational responses.

**9.6 Logging**
    • **In the current code base, most of the console.log statements were commented out, except statements related to monitoring the app.**For production I suggest replace them with a configurable looging library(e.g. Bunyan or Winston,) that allows us to set log levels and manage outputs having to comment or uncomment code manually

**9.7 General Best Practices**
    • Ensure the infrastructure spans multiple Availability Zones (which AWS managed services do by default) to avoid single points of failure.
    • Regularly perform load testing and chaos engineering exercises to validate that scaling policies and thresholds hold up under stress.
    • Consider multi-region deployments or backups as PostNL application requires extreme fault tolerance.

---

### 10. Questions:

**10.1** How would you approach the design, build, test and deploy of this service AWS 'cloud natively', and 'as-a-service'? </br>
**10.2** What can you suggest about design patterns, software architecture and/or other measures to make the code understandable and manageable for the team?</br>
**10.3** What would you suggest with regard to: 24x7 business criticality, auto-scaling and auto-healing requirements?</br>
**10.4** What would be the outline for the Software Architecture document to be created by the team? What parts to be defined first?</br>
**10.5** What do you expect from a Product Owner (BizDevOps) and your engineering peers </br>

---

## 11. Stay in Touch

- Author - [Miguel Gil](https://www.linkedin.com/in/mggil/)
- email - [miguel.gustavo.gil@gmail.com](miguel.gustavo.gil@gmail.com)
- mobile - +31 6 450 36 513
- 1181 CR Amstelveen, The Netherlands

---
## 12. License

```markdown
This project is licensed under the MIT License. You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, provided that proper credit is given.

See the [LICENSE](./LICENSE) file for more details.
```

