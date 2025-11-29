const Student = require('../models/Student');
const bcrypt = require('bcryptjs');

// Student Signup
const studentSignup = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if student already exists
        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
            return res.status(400).json({
                success: false,
                message: 'Student already exists with this email'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create student
        const student = await Student.create({
            email,
            password: hashedPassword
        });

        res.status(201).json({
            success: true,
            message: 'Student registered successfully',
            data: {
                id: student._id,
                email: student.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in student signup',
            error: error.message
        });
    }
};

// Student Login
const studentLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find student
        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Student login successful',
            data: {
                id: student._id,
                email: student.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in student login',
            error: error.message
        });
    }
};

module.exports = {
    studentSignup,
    studentLogin
};