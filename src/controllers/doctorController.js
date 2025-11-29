const Doctor = require('../models/Doctor');
const bcrypt = require('bcryptjs');

// Doctor Signup
const doctorSignup = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if doctor already exists
        const existingDoctor = await Doctor.findOne({ email });
        if (existingDoctor) {
            return res.status(400).json({
                success: false,
                message: 'Doctor already exists with this email'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create doctor
        const doctor = await Doctor.create({
            email,
            password: hashedPassword
        });

        res.status(201).json({
            success: true,
            message: 'Doctor registered successfully',
            data: {
                id: doctor._id,
                email: doctor.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in doctor signup',
            error: error.message
        });
    }
};

// Doctor Login
const doctorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find doctor
        const doctor = await Doctor.findOne({ email });
        if (!doctor) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, doctor.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Doctor login successful',
            data: {
                id: doctor._id,
                email: doctor.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in doctor login',
            error: error.message
        });
    }
};

module.exports = {
    doctorSignup,
    doctorLogin
};