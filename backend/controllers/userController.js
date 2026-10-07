const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/User");

const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Name, email, phone number and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: normalizedEmail },
          { phone: normalizedPhone }
        ]
      }
    });

    if (existingUser) {
      const message = existingUser.email === normalizedEmail
        ? "User with this email already exists"
        : "User with this phone number already exists";

      return res.status(409).json({ message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword
    });

    return res.status(201).json({
      message: "User signed up successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Email or phone number is already registered"
      });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Email or phone number and password are required"
      });
    }

    const value = identifier.trim();
    const isEmail = value.includes("@");

    const user = await User.findOne({
      where: isEmail
        ? { email: value.toLowerCase() }
        : { phone: value }
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email/phone number or password"
      });
    }

    const passwordMatched = await bcrypt.compare(password, user.password);

    if (!passwordMatched) {
      return res.status(401).json({
        message: "Invalid email/phone number or password"
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const searchUserByEmail = async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({
      where: { email },
      attributes: ["id", "name", "email", "phone"]
    });

    if (!user) {
      return res.status(404).json({ message: "No user found with this email" });
    }

    if (Number(user.id) === Number(req.user.id)) {
      return res.status(400).json({ message: "You cannot start a chat with yourself" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Search user error:", error);
    return res.status(500).json({ message: "Unable to search user" });
  }
};

module.exports = { signup, login, searchUserByEmail };
