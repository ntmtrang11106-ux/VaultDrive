# Stage 1: Build bằng Maven (đặt alias tên là builder)
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app

# Copy các file cấu hình Maven để cache dependencies
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn
COPY src ./src

# Cấp quyền thực thi cho mvnw và build file jar
RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests

# Stage 2: Run app bằng JDK 21
FROM eclipse-temurin:21-jdk
WORKDIR /app

# Khớp alias builder ở trên
COPY --from=builder /app/target/*.jar app.jar

# Tạo thư mục chứa file upload
RUN mkdir -p /app/uploads

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]