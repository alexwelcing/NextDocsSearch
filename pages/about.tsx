import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/About.module.css';

function About() {
    return (
        <div className="p-8 font-sans max-w-3xl mx-auto bg-gray-100 text-gray-800">
            <Head>
                <title>Alex Welcing - About</title>
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet"></link>
            </Head>

            <div className="shadow-lg p-8 rounded-lg space-y-2"> {/* Increased vertical spacing */}
                <div className="flex justify-between">
                    <div className="text-pink-700 mb-2 mt-0 text-3xl">
                        Alex Welcing
                    </div>
                </div>

                <h3 className="text-xl font-semibold space-y-4">Senior Technical Product Manager</h3>
                <p className="text-xl leading-tight space-y-2">
                    Results-oriented leader, adept in defining product enhancements, prioritizing crucial features, and delivering solutions that directly address market challenges and meet customers’ ever-evolving needs. Recognized success creating strategic products and aligning with overall business objectives and market opportunities. Skilled at driving business growth by managing and launching business-defining projects, such as digital content management, asset management in VR experiences, subscription-based legal analysis services, and AI-enabled ads for publishers. Well-versed in fostering cross-functional collaboration, leading teams with excellence, and utilizing market insights to position products strategically and effectively. Expertise in gathering and documenting business and functional requirements to drive technical product development.
                </p>
                <h4 className="text-pink-700 mb-4 mt-4 text-xl font-semibold leading-tight text-primary space-y-4">Core Competencies</h4>
                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="flex items-center space-x-2 p-2 bg-blue-100 rounded hover:bg-blue-200 transition">
                        <span className="material-icons-outlined">build</span>
                        <span>Product Development</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-green-100 rounded hover:bg-green-200 transition">
                        <span className="material-icons-outlined">group_work</span>
                        <span>Strategic Partnerships</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-purple-100 rounded hover:bg-purple-200 transition">
                        <span className="material-icons-outlined">emoji_people</span>
                        <span>Consumer Experience</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-yellow-100 rounded hover:bg-yellow-200 transition">
                        <span className="material-icons-outlined">leaderboard</span>
                        <span>Team Leadership</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-red-100 rounded hover:bg-red-200 transition">
                        <span className="material-icons-outlined">code</span>
                        <span>Software Development</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-indigo-100 rounded hover:bg-indigo-200 transition">
                        <span className="material-icons-outlined">analytics</span>
                        <span>Data Analytics</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-pink-100 rounded hover:bg-pink-200 transition">
                        <span className="material-icons-outlined">event_note</span>
                        <span>Project Management</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-teal-100 rounded hover:bg-teal-200 transition">
                        <span className="material-icons-outlined">add_task</span>
                        <span>Strategic Planning</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded hover:bg-gray-200 transition">
                        <span className="material-icons-outlined">psychology</span>
                        <span>Critical Problem Solving</span>
                    </div>
                </div>
                <h4 className="text-pink-700 mb-2 mt-0 text-xl font-semibold leading-tight text-primary space-y-2">Professional Experience</h4>
                <div className=" bg-white shadow-lg p-8 rounded-lg space-y-8"> {/* Increased spacing between job cards */}
                    {/* OBSESS VR Experience */}
                    <div>
                        <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">ObsessVR • Product Manager @ 360 Visual Commerce Startup</h5>
                        <h6>New York | 2022-2023</h6>
                        <p>
                            Defined product enhancements, prioritized essential features, and delivered products that addressed market challenges and met customer needs by liaising with customers, engineering, marketing, and customer success teams.
                        </p>
                        <ul className="list-disc pl-5">
                            <li>Succeeded in launching cutting-edge SaaS platform features by leveraging open-source development, large-language models for code, and generative AI to rapidly create working prototypes.</li>
                            <li>Enhanced consumer product and team experience by demonstrating exceptional leadership.</li>
                            <li>Optimized marketing data pipeline by re-writing implementation of the Google Analytics 4 API.</li>
                            <li>Played a pivotal role in product development of Real-Time 3D rendering, enabling users to move animated characters in three-dimensional spaces.</li>
                        </ul>
                    </div>
                </div>
                <div className=" bg-white shadow-lg p-8 rounded-lg space-y-8">

                    {/* Manatt, Phelps, & Phillips Experience */}
                    <div>
                        <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">Manatt, Phelps, & Phillips • Developer @ AmLaw 200 Firm</h5>
                        <h6>New York | 2019-2022</h6>
                        <p>
                            Led the transformation of innovative ideas into practical applications by offering specialized technical expertise and actively participated in hands-on development and design.
                        </p>
                        <ul className="list-disc pl-5">
                            <li>Steered developing and deploying a proprietary SaaS platform that provided secure content access to legal and regulatory analysis, offering clients a reliable and trusted source for critical information.</li>
                            <li>Developed an AI document scanning and image selection system for publication, resulting in significant time savings for consultants, enhanced accuracy of the product knowledge graph, and elimination of human error.</li>
                            <li>Empowered decision-makers to make informed strategic choices and stay ahead in the dynamic healthcare landscape by generating in-depth data analysis content tailored for executive leadership.</li>
                            <li>Built and maintained firm-wide knowledge and training portal, delivering extraordinary ROI with minimal operating and development costs.</li>
                        </ul>
                    </div>
                </div>
                <div className=" bg-white shadow-lg p-8 rounded-lg space-y-8">
                    {/* MANATT HEALTH Experience */}
                    <div>
                        <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">Manatt Health • Consultant @ Healthcare Legal Practice</h5>
                        <h6>New York | 2017-2019</h6>
                        <p>
                            Crafted and launched a client-exclusive publishing SaaS platform, propelling it from its beta phase to an impressive achievement of generating millions in Annual Recurring Revenue (ARR).
                        </p>
                        <ul>
                            <li>Supported internal executives to understand how customers interacted with the product by conducting thorough data analysis.</li>
                            <li>Oversaw all aspects of publication data reporting, security, and service monitoring, providing recurring reporting on site health and opportunities for user experience improvements.</li>
                            <li>Managed publication operations, including regulatory summaries, 50 state policy interactive visualizations, and weekly analysis.</li>
                        </ul>
                    </div>
                </div>
                <div className=" bg-white shadow-lg p-8 rounded-lg space-y-8">

                    {/* ARKADIUM Experience */}
                    <div>
                        <h5 className="text-blue-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">Arkadium • Partner Development @ AdTech SaaS </h5>
                        <h6 className="font-medium leading-tight">New York | 2016-2017</h6>
                        <p>
                            Spearheaded the end-to-end business development process, securing valuable artificial intelligence partnerships with top digital publishers.
                        </p>
                        <ul className="list-disc pl-5">
                            <li>Introduced an ingenious NLP-driven interactive advertising content solution specifically designed for publishers by leveraging expertise in new business development.</li>
                            <li>Pioneered the development of groundbreaking AI partnerships by leveraging NLP contextual understanding to create interactive content.</li>
                        </ul>
                    </div>
                </div>
                <div className=" bg-white shadow-lg p-8 rounded-lg space-y-2">
                    <h5 className="text-pink-700 mb-2 mt-0 text-xl font-medium leading-tight text-primary">Education</h5>
                    <h6 className="font-medium leading-tight">
                        Bachelor of Science in Marketing, 2010-2013 <br />
                        University of Texas at Dallas <br />
                        Naveen Jindal School of Management
                    </h6>
                </div>
            </div>
        </div>
        );
}

export default About;
